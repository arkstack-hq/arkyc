import { Broadcast, Notification, type RealtimeNotificationPayload } from '@arkstack/notifications'
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences, type NotificationType } from '@arkyc/types'
import type { User } from '@app/models/User'
import { UserPushToken } from '@app/models/UserPushToken'
import { reportError } from 'src/support/observability'
import { toArray } from 'src/support/collection'

/** What a notification says, independent of who receives it. */
export interface NotificationPayload {
  type: NotificationType
  title: string
  description: string
  actionText?: string | null
  actionLink?: string | null
  meta?: Record<string, unknown> | null
  /** Identifies what the notification is about, so a later one replaces it on clients. */
  tag?: string | null
}

/** Most devices a single user is pushed to. */
const DEVICE_LIMIT = 50

/**
 * Delivers a notification to one user: stores it, streams it on their private
 * channel, then pushes it to their devices when they allow push.
 */
export class UserNotifier {
  /**
   * Store and stream the notification, then push it best-effort.
   *
   * @param user
   * @param payload
   */
  async deliver(user: User, payload: NotificationPayload): Promise<void> {
    const notification = Notification.realtime()
      .recipient(user as never)
      .store()
      .push(false)
      .type(payload.type)
      .subject(payload.title)
      .action(payload.actionText ?? null, payload.actionLink ?? null)
      .meta(payload.meta ?? null)

    if (payload.tag) notification.tag(payload.tag)

    const result = await notification.send(payload.description, payload.title)

    if (this.preferences(user).push) {
      await this.push(user, result.event, result.payload)
    }
  }

  /**
   * The user's preferences merged over the defaults.
   *
   * @param user
   * @returns
   */
  preferences(user: User): NotificationPreferences {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(user.notificationPreferences ?? {}) }
  }

  /**
   * Push to the user's active devices and drop the tokens the transport rejects.
   * Never throws.
   *
   * @param user
   * @param event
   * @param payload
   */
  private async push(user: User, event: string, payload: RealtimeNotificationPayload): Promise<void> {
    try {
      const tokens = toArray(
        await UserPushToken.where({ userId: user.id, isActive: true })
          .latest('lastRegisteredAt')
          .limit(DEVICE_LIMIT)
          .pluck('token'),
      ) as string[]

      const result = await Broadcast.push(tokens, event, payload)

      if (result?.invalidTokens.length) {
        await UserPushToken.query().whereIn('token', result.invalidTokens).delete()
      }
    } catch (error) {
      reportError(error, { scope: 'notifications.push', userId: user.id })
    }
  }
}

/** Shared singleton notifier. */
export const userNotifier = new UserNotifier()
