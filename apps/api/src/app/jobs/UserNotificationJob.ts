import { Job } from '@arkstack/jobs'
import { User } from '@app/models/User'
import { type NotificationPayload, userNotifier } from '@app/notifications/UserNotifier'
import { reportError } from 'src/support/observability'
import { toArray } from 'src/support/collection'

/**
 * Delivers one notification to a bounded batch of users (queue `queue.queues.notifications`).
 * A failure for one user is reported and does not stop the rest, and the job
 * never throws, so a retry can't store a notification twice.
 */
export class UserNotificationJob extends Job {
  override queue = config('queue.queues.notifications', 'notifications')
  override tries = 1

  constructor(
    public userIds: string[],
    public payload: NotificationPayload,
  ) {
    super()
  }

  async handle(): Promise<void> {
    const users = toArray(await User.query().whereIn('id', this.userIds).get())

    for (const user of users) {
      if (user.status === 'suspended') continue

      try {
        await userNotifier.deliver(user, this.payload)
      } catch (error) {
        reportError(error, { scope: 'notifications.deliver', userId: user.id, type: this.payload.type })
      }
    }
  }
}
