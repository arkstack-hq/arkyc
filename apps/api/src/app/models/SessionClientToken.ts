import { Model } from 'arkormx'
import { VerificationSession } from './VerificationSession'

/** What a client token is for: see {@link SessionClientToken}. */
export type ClientTokenKind = 'launch' | 'handoff' | 'device'

/**
 * A client token for one verification session. `launch` and `handoff` tokens are
 * single-use and only exchange for a `device` token, which every other Client API
 * call uses and which stays bound to the origin that claimed it.
 */
export class SessionClientToken extends Model {
  protected static override table = 'session_client_tokens'

  declare id: string
  declare sessionId: string
  declare tokenHash: string
  declare kind: ClientTokenKind
  declare origin: string | null
  declare claimedAt: Date | null
  declare ipAddress: string | null
  declare userAgent: string | null
  declare expiresAt: Date
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    sessionId: 'session_id',
    tokenHash: 'token_hash',
    claimedAt: 'claimed_at',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  session() {
    return this.belongsTo(VerificationSession, 'sessionId', 'id')
  }
}
