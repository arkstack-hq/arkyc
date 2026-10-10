import { BaseController } from '@controllers/BaseController'
import { Broadcast } from '@arkstack/notifications'
import { HttpContext } from 'clear-router/types/express'

/**
 * Realtime client glue for dashboard users: the channel authorizer and the
 * public settings a client connects with.
 */
export default class RealtimeController extends BaseController {
  /**
   * Authorize the caller for a private channel against the channel rules and
   * answer in the active transport's terms (a Pusher signature or a Firebase token).
   *
   * @param ctx
   */
  async auth({ req, res }: HttpContext) {
    const request = {
      socket_id: this.body?.socket_id as string | undefined,
      channel_name: this.body?.channel_name as string | undefined,
    }

    const result = await Broadcast.handleAuth(req.user, request)

    // Pusher-compatible clients expect HTTP 200 with the raw body.
    res.status(200).json(result ?? {})
  }

  /**
   * The active transport and its public connection settings.
   *
   * @returns
   */
  async config() {
    return {
      status: 'success',
      message: 'OK', code: 200,
      data: Broadcast.clientConfig()
    }
  }
}
