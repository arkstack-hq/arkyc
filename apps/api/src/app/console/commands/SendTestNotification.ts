import { Command } from '@h3ravel/musket'
import { User } from 'src/app/models/User'
import { UserNotificationCenter } from '@arkstack/notifications'

export class SendTestNotification extends Command {
  protected signature = `send:test-notification
        {userId? : The ID of the user to send the notification to (optional, will prompt if not provided)}
        {--t|title? : The title of the notification (optional, will prompt if not provided)}
        {--d|description? : The description of the notification (optional, will prompt if not provided)}
    `
  protected description = 'Send a test notification to a user'

  async handle() {
    const notificationTypes = ['transaction', 'pocket', 'family', 'security', 'promo', 'bill', 'goal'] as const

    let userId = this.argument('userId')

    if (!userId) {
      const users = (
        await User.query()
          .select({
            id: true,
            firstName: true,
            lastName: true,
          })
          .get()
      ).all()

      if (!users.length) {
        this.error('No users found. Create a user before sending a test notification.')

        return
      }

      userId = await this.choice(
        'Choose a user to send the test notification to:',
        users.map((user) => ({
          name: `${user.firstName} ${user.lastName}`.trim(),
          value: user.id,
        })),
      )
    }

    const user = await User.query().find(userId)

    if (!user) {
      this.error(`User with id ${userId} was not found.`)

      return
    }

    const type = (await this.choice(
      'Choose a notification type:',
      notificationTypes.map((notificationType) => ({
        name: notificationType,
        value: notificationType,
      })),
      3,
    )) as (typeof notificationTypes)[number]

    const title = this.option('title') || (await this.ask('Enter the notification title:'))

    const description = this.option('description') || (await this.ask('Enter the notification description:'))

    const actionLink = (await this.ask('Enter an action link (optional):')) || undefined
    const actionText = actionLink
      ? (await this.ask('Enter an action button label (optional):')) || undefined
      : undefined
    try {
      const notification = await UserNotificationCenter.create(user, {
        type,
        title,
        description,
        actionLink,
        actionText,
        meta: {
          source: 'console',
          sentAt: new Date().toISOString(),
        },
      })

      this.info(`Notification ${notification.id} sent to ${user.name}`)
    } catch (error) {
      this.error(`Failed to send notification: ${(error as Error).message}`)
    }
  }
}
