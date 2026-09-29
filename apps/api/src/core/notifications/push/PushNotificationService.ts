import { Notification } from '@arkstack/notifications'
import { UserPushToken } from '@app/models/UserPushToken'

export type PushMessage = {
  title: string
  body: string
  data?: Record<string, string>
}

export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<{ invalidTokens: string[] }>
}

/** Used when no transport is configured (e.g. local/CI without Firebase credentials). */
class NoopPushSender implements PushSender {
  async send() {
    return { invalidTokens: [] as string[] }
  }
}

export class PushNotificationService {
  private static sender: PushSender | null = null
  private static resolved: PushSender | null = null

  /** Inject a transport (tests use this; pass null to fall back to the default). */
  static useSender(sender: PushSender | null) {
    this.sender = sender
    this.resolved = null
  }

  private static async resolveSender(): Promise<PushSender> {
    if (this.sender) return this.sender
    if (this.resolved) return this.resolved

    try {
      this.resolved = {
        async send(tokens, message) {
          const resp = (await Notification.realtime()
            .channel(tokens)
            .send(message.body, message.title, undefined, message.data)) as unknown as {
            invalidTokens: string[]
          }

          return resp
        },
      }
    } catch {
      this.resolved = new NoopPushSender()
    }

    return this.resolved
  }

  /** Fan a notification out to every active device a user has registered. Best-effort. */
  static async sendToUser(userId: string, message: PushMessage) {
    try {
      const tokens = (await UserPushToken.query().where({ userId, isActive: true }).get()).all()
      if (!tokens.length) return

      const sender = await this.resolveSender()
      // TODO: Investigate if realtime really sends the invalid tokens and profer an Arkstack level fix.
      const { invalidTokens } = await sender.send(
        tokens.map((token) => token.token),
        message,
      )

      // Prune tokens the provider rejected so we stop sending to dead devices.
      if (invalidTokens && invalidTokens.length) {
        await UserPushToken.query().whereIn('token', invalidTokens).update({ isActive: false })
      }
    } catch {
      //
    }
  }
}
