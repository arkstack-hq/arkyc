import type { QueryBuilder } from 'arkormx'
import type { NotificationType } from '@arkyc/types'
import type { User } from '@app/models/User'
import { UserNotificationJob } from '@app/jobs/UserNotificationJob'
import { reportError } from 'src/support/observability'
import type { NotificationPayload } from './UserNotifier'

type UserQuery = QueryBuilder<User>

/** Users per delivery job. */
const BATCH_SIZE = 200

/**
 * One application event to notify users about. Name the recipients and the
 * actor, describe the event, then call {@link dispatchSafely} after the write
 * that caused it has succeeded. The actor is never notified of their own action.
 *
 * @example
 * await NotificationEvent.make(NOTIFICATION_TYPE.reviewAssigned)
 *   .to([assigneeId])
 *   .by(actorId)
 *   .about({ title, description, actionLink })
 *   .dispatchSafely()
 */
export class NotificationEvent {
  private recipientIds = new Set<string>()
  private audience: (() => Promise<UserQuery>) | null = null
  private actorId: string | null = null
  private content: Omit<NotificationPayload, 'type'> = { title: '', description: '' }

  private constructor(private readonly type: NotificationType) {}

  /**
   * Start an event of the given type.
   *
   * @param type
   * @returns
   */
  static make(type: NotificationType): NotificationEvent {
    return new NotificationEvent(type)
  }

  /**
   * Notify these users. Empty values are ignored.
   *
   * @param userIds
   * @returns
   */
  to(userIds: Array<string | null | undefined>): this {
    for (const id of userIds) if (id) this.recipientIds.add(id)

    return this
  }

  /**
   * Notify every user the query matches, processed in bounded batches. The
   * query is built when dispatching, so a failure there is contained too.
   *
   * @param query
   * @returns
   */
  toAudience(query: () => Promise<UserQuery>): this {
    this.audience = query

    return this
  }

  /**
   * The user who caused the event. They are excluded from the recipients.
   *
   * @param actorId
   * @returns
   */
  by(actorId: string | null | undefined): this {
    this.actorId = actorId ?? null

    return this
  }

  /**
   * What the notification says and links to.
   *
   * @param content
   * @returns
   */
  about(content: Omit<NotificationPayload, 'type'>): this {
    this.content = content

    return this
  }

  /**
   * Queue delivery to every recipient. Failures are reported, never thrown, so
   * notifying can't break the operation that triggered it.
   */
  async dispatchSafely(): Promise<void> {
    try {
      await this.dispatch()
    } catch (error) {
      reportError(error, { scope: 'notifications.dispatch', type: this.type })
    }
  }

  private async dispatch(): Promise<void> {
    const payload: NotificationPayload = { ...this.content, type: this.type }
    const direct = [...this.recipientIds].filter((id) => id !== this.actorId)

    for (let i = 0; i < direct.length; i += BATCH_SIZE) {
      await UserNotificationJob.dispatch(direct.slice(i, i + BATCH_SIZE), payload)
    }

    if (!this.audience) return

    const audience = await this.audience()

    await audience.chunkById(BATCH_SIZE, async (users) => {
      const ids = users
        .all()
        .map((user) => user.id)
        .filter((id) => id !== this.actorId && !this.recipientIds.has(id))

      if (ids.length) await UserNotificationJob.dispatch(ids, payload)
    })
  }
}
