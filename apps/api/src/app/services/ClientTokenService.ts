import { Token } from '@arkyc/auth'
import { Project } from '@app/models/Project'
import { SessionClientToken } from '@app/models/SessionClientToken'
import { VerificationSession } from '@app/models/VerificationSession'
import { ApiException } from 'src/support/apiErrors'
import { isOriginAllowed, normalizeOrigin } from 'src/support/origins'

/** A device token issued by a claim. */
export interface ClaimedClientToken {
  session: VerificationSession
  token: string
  expiresAt: Date
}

/**
 * Issues, claims and authenticates the client tokens that let a browser drive a
 * verification session. Launch and handoff tokens are single-use and only buy a
 * device token; device tokens authorize every other Client API call from the
 * origin that claimed them.
 */
export class ClientTokenService {
  /**
   * Mint a single-use token for the session. A new handoff token replaces any
   * unclaimed one, so only the latest QR code works.
   *
   * @param session
   * @param kind
   * @returns The raw token.
   */
  async issue(session: VerificationSession, kind: 'launch' | 'handoff'): Promise<string> {
    if (kind === 'handoff') {
      await SessionClientToken.query().where({ sessionId: session.id, kind: 'handoff' }).whereNull('claimedAt').delete()
    }

    return await this.create(session, kind, null)
  }

  /**
   * Exchange a launch or handoff token for a device token bound to `origin`.
   * Claiming is atomic, so a token can be claimed once.
   *
   * @param rawToken
   * @param origin
   * @returns
   */
  async claim(rawToken: string, origin: string | null): Promise<ClaimedClientToken> {
    const token = await SessionClientToken.where({ tokenHash: Token.hash(rawToken) }).first()
    if (!token || token.kind === 'device') throw new ApiException('invalid_client_token')

    const session = await this.activeSession(token)
    await this.assertProjectOrigin(session, origin)

    const claimed = await SessionClientToken.query()
      .where({ id: token.id })
      .whereNull('claimedAt')
      .updateFrom({ claimedAt: new Date(), origin: origin ? normalizeOrigin(origin) : null })
    if (claimed === 0) throw new ApiException('client_token_used')

    return {
      session,
      token: await this.create(session, 'device', origin),
      expiresAt: new Date(session.expiresAt),
    }
  }

  /**
   * Resolve the session a device token authorizes, from the origin it was claimed on.
   *
   * @param rawToken
   * @param origin
   * @returns
   */
  async authenticate(rawToken: string, origin: string | null): Promise<VerificationSession> {
    const token = await SessionClientToken.where({ tokenHash: Token.hash(rawToken) }).first()
    if (!token || token.kind !== 'device') throw new ApiException('invalid_client_token')

    const session = await this.activeSession(token)

    if (origin && token.origin && normalizeOrigin(origin) !== token.origin) {
      throw new ApiException('origin_not_allowed')
    }

    await this.assertProjectOrigin(session, origin)

    return session
  }

  private async create(
    session: VerificationSession,
    kind: SessionClientToken['kind'],
    origin: string | null,
  ): Promise<string> {
    const { token, tokenHash } = Token.createPair()

    await SessionClientToken.create({
      sessionId: session.id,
      tokenHash,
      kind,
      origin: origin ? normalizeOrigin(origin) : null,
      expiresAt: new Date(session.expiresAt),
    })

    return token
  }

  /**
   * The token's session, provided neither has expired.
   *
   * @param token
   * @returns
   */
  private async activeSession(token: SessionClientToken): Promise<VerificationSession> {
    if (new Date(token.expiresAt).getTime() <= Date.now()) throw new ApiException('session_expired')

    const session = await VerificationSession.where({ id: token.sessionId }).first()
    if (!session) throw new ApiException('invalid_client_token')
    if (new Date(session.expiresAt).getTime() <= Date.now()) throw new ApiException('session_expired')

    return session
  }

  /**
   * Enforce the project's opt-in origin allowlist on browser requests.
   *
   * @param session
   * @param origin
   */
  private async assertProjectOrigin(session: VerificationSession, origin: string | null): Promise<void> {
    if (!origin) return

    const project = await Project.where({ id: session.projectId }).first()
    if (!isOriginAllowed(project?.settings?.allowed_origins, origin)) throw new ApiException('origin_not_allowed')
  }
}

/** Shared singleton. */
export const clientTokens = new ClientTokenService()
