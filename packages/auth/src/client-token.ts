import { createTokenPair, verifyToken } from './tokens.js';

import type { IsoDateTime } from '@arkyc/types';

/** Default lifetime for a widget client token (15 minutes). */
export const DEFAULT_CLIENT_TOKEN_TTL_SECONDS = 15 * 60;

/** A short-lived client token issued to the widget for one session. */
export interface ClientToken {
  /** Opaque token handed to the browser/widget. */
  token: string;
  /** Hash stored on the session (`client_token_hash`). */
  tokenHash: string;
  /** When the token (and typically the session) expires. */
  expiresAt: IsoDateTime;
}

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
export function createClientToken (
  ttlSeconds: number = DEFAULT_CLIENT_TOKEN_TTL_SECONDS,
  now: Date = new Date(),
): ClientToken {
  const { token, tokenHash } = createTokenPair(32);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  return { token, tokenHash, expiresAt };
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
export function isClientTokenValid (
  token: string,
  tokenHash: string,
  expiresAt: IsoDateTime,
  now: Date = new Date(),
): boolean {
  if (now.getTime() >= new Date(expiresAt).getTime()) return false;
  return verifyToken(token, tokenHash);
}
