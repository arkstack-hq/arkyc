import { Token } from './tokens'

import type { IsoDateTime } from '@arkyc/types'

/** A short-lived client token issued to the widget for one session. */
export interface IssuedClientToken {
  /** Opaque token handed to the browser/widget. */
  token: string
  /** Hash stored on the session (`client_token_hash`). */
  tokenHash: string
  /** When the token (and typically the session) expires. */
  expiresAt: IsoDateTime
}

/** Short-lived widget client token creation and validation. */
export class ClientToken {
  /** Default lifetime for a widget client token (15 minutes). */
  static readonly DEFAULT_TTL_SECONDS = 15 * 60

  /**
   * Create a short-lived client token for the widget.
   *
   * `now` is injectable for testing; it defaults to the current time. The returned
   * `expiresAt` is `now + ttl`.
   *
   * @param ttlSeconds
   * @param now
   * @returns
   */
  static create(ttlSeconds: number = ClientToken.DEFAULT_TTL_SECONDS, now: Date = new Date()): IssuedClientToken {
    const { token, tokenHash } = Token.createPair(32)
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString()
    return { token, tokenHash, expiresAt }
  }

  /**
   * Validate a presented client token against the stored hash and expiry.
   * Returns true only when the token matches and has not expired.
   *
   * @param token
   * @param tokenHash
   * @param expiresAt
   * @param now
   * @returns
   */
  static isValid(token: string, tokenHash: string, expiresAt: IsoDateTime, now: Date = new Date()): boolean {
    if (now.getTime() >= new Date(expiresAt).getTime()) return false
    return Token.verify(token, tokenHash)
  }
}
