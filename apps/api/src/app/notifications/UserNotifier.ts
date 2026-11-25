import { Broadcast, Notification, type RealtimeNotificationPayload } from '@arkstack/notifications'
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences, type NotificationType } from '@arkyc/types'
import type { User } from '@app/models/User'
import { UserPushToken } from '@app/models/UserPushToken'
import { reportError } from 'src/support/observability'
import { escapeHtml, sendMail } from '@app/support/mail'
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
  /** Also email the recipient. */
  email?: boolean
}

/** Most devices a single user is pushed to. */
const DEVICE_LIMIT = 50

/**
 * Delivers a notification to one user: stores it, streams it on their private
 * channel, pushes it to their devices when they allow push, and emails it when
 * the event asks for email.
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

    if (payload.email && user.email) await this.mail(user, payload)
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
   * Email the notification, linking to its dashboard action when it has one.
   *
   * @param user
   * @param payload
   */
  private async mail(user: User, payload: NotificationPayload): Promise<void> {
    const msg = config('messages.notification.email')
    const link = payload.actionLink
      ? `${String(config('app.frontend_url', '')).replace(/\/$/, '')}${payload.actionLink}`
      : null

    await sendMail(user.email, link ? msg.template_with_action : msg.template, msg.subject, {
      name: escapeHtml(user.firstName || user.name || ''),
      title: payload.title,
      description: escapeHtml(payload.description),
      action_text: escapeHtml(payload.actionText || 'Open dashboard'),
      action_link: link ? escapeHtml(link) : '',
    })
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
