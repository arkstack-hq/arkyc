import { RequestException } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { parseRealtimeChannel } from '@arkyc/types'
import { BaseController } from '@controllers/BaseController'
import { realtime } from '@app/services/RealtimeService'
import { OrganizationMember } from '@app/models/OrganizationMember'
import { VerificationSession } from '@app/models/VerificationSession'
import { toArray } from 'src/support/collection'

type ChannelScope = NonNullable<ReturnType<typeof parseRealtimeChannel>>

/**
 * Realtime client glue (Phase 16): the Pusher private-channel authorizer and a
 * config endpoint telling the browser how to connect to the active transport.
 */
export default class RealtimeController extends BaseController {
  /**
   * Pusher channel-auth endpoint. Authorizes the caller for the requested
   * private channel (by organization/project/session scope), then returns the signed
   * subscription the client needs. Returns the raw Pusher `{ auth }` object.
   */
  async auth({ req, res }: HttpContext) {
    const user = req.user
    RequestException.assertFound(user, 'Unauthenticated', 401)

    const socketId = String((this.body?.socket_id as string) ?? '')
    const channel = String((this.body?.channel_name as string) ?? '')
    RequestException.abortIf(!socketId || !channel, 'Missing socket_id/channel_name', 422)

    const scope = parseRealtimeChannel(channel)
    RequestException.assertFound(scope, 'Unknown channel', 403)

    const organizationIds = await this.userOrganizationIds(user.id)
    RequestException.abortIf(!(await this.canAccess(scope, new Set(organizationIds))), 'Forbidden channel', 403)

    const signed = await realtime.authorizeChannel(socketId, channel)
    RequestException.assertFound(signed, 'Channel auth unavailable for this transport', 409)

    // Pusher-compatible clients expect HTTP 200 with the raw `{ auth }` body.
    res.status(200).json(signed)
  }

  /**
   * Tell the client which transport is active and how to connect (public params
   * only). For firebase, also mints a per-user custom token carrying the caller's
   * organization claims.
   */
  async config({ req }: HttpContext) {
    const user = req.user
    RequestException.assertFound(user, 'Unauthenticated', 401)

    const config = await realtime.clientConfig()
    let token: string | null = null
    if (config.transport === 'firebase') {
      const organizationIds = await this.userOrganizationIds(user.id)
      token = await realtime.mintClientToken(user.id, { organizations: organizationIds })
    }

    return { status: 'success', message: 'OK', code: 200, data: { ...config, token } }
  }

  private async userOrganizationIds(userId: string): Promise<string[]> {
    const members = toArray(await OrganizationMember.where({ userId }).get())

    return members.map((m) => m.organizationId)
  }

  private async canAccess(scope: ChannelScope, organizationIds: Set<string>): Promise<boolean> {
    if (scope.kind === 'organization') return organizationIds.has(scope.organizationId)
    if (scope.kind === 'project') return organizationIds.has(scope.organizationId)
    // session: the session must belong to one of the caller's organizations.
    const session = await VerificationSession.where({ id: scope.sessionId }).first()

    return !!session && organizationIds.has(session.organizationId)
  }
}
