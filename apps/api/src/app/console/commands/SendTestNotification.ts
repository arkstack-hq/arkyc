import { Notification, UserNotificationCenter } from '@arkstack/notifications'

import { Command } from '@h3ravel/musket'
import { PushNotificationService } from 'src/core/notifications/push/PushNotificationService'
import { User } from 'src/app/models/User'

export class SendTestNotification extends Command {
  protected signature = `send:test-notification
        {userId? : The ID of the user to send the notification to (optional, will prompt if not provided)}
        {--t|title? : The title of the notification (optional, will prompt if not provided)}
        {--c|channel? : Test notification for a specific service (other options will be ignored): [sms, mail, db, realtime]}
        {--d|description? : The description of the notification (optional, will prompt if not provided)}
    `
  protected description = 'Send a test notification to a user'

  async handle() {
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

    const user = await User.query()
      .where(userId.includes('@') ? { email: userId } : { id: userId })
      .first()

    if (this.option('channel')) {
      const service = this.option('channel')

      this.info(`SENDING: Test notification to ${service} channel for user ${user?.name ?? userId}`)

      try {
        if (service === 'sms')
          await Notification.sms()
            .recipient(user?.phone ?? userId)
            .send('Test notification message from Arkyc')
        if (service === 'mail')
          await Notification.mail()
            .recipient(user?.email ?? userId)
            .view('email/template')
            .send('Test notification message from Arkyc', 'Test Mail')
        if (service === 'db')
          await Notification.db()
            .recipient(user ?? userId)
            .send('Test notification message from Arkyc', 'Test DB Notification')
        if (service === 'realtime')
          await PushNotificationService.sendToUser(user?.id ?? userId, {
            title: 'Test DB Notification',
            body: 'Test notification message from Arkyc',
            data: { type: 'test' },
          })

        this.info(`SENT: Test notification sent to ${service} channel for user ${user?.name ?? userId}`)
      } catch (error) {
        this.error(`ERROR: Failed to send test notification for channel ${service} [${(error as Error).message}]`)
      }

      return
    }

    if (!user) {
      this.error(`User with id ${userId} was not found.`)

      return
    }

    const title = this.option('title') || (await this.ask('Enter the notification title:'))

    const description = this.option('description') || (await this.ask('Enter the notification description:'))

    const actionLink = (await this.ask('Enter an action link (optional):')) || undefined
    const actionText = actionLink
      ? (await this.ask('Enter an action button label (optional):')) || undefined
      : undefined
    try {
      await UserNotificationCenter.create(user, {
        type: 'generic',
        title,
        description,
        actionLink,
        actionText,
        meta: {
          source: 'console',
          sentAt: new Date().toISOString(),
        },
      })

      this.info(`Notification sent to ${user.name}`)
    } catch (error) {
      this.error(`Failed to send notification: ${(error as Error).message}`)
    }
  }
}
