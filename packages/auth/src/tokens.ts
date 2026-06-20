import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generate a cryptographically-random, URL-safe opaque token.
 *
 * @param byteLength Entropy in bytes (default 32 → ~43-char base64url string).
 *
 * @param byteLength
 * @returns
 */
export function generateToken (byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

/**
 * SHA-256 hex digest of a value. Used to store hashes of opaque secrets.
 *
 * @param value
 * @returns
 */
export function sha256 (value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Hash an opaque token for at-rest storage (e.g. `token_hash` columns).
 *
 * @param token
 * @returns
 */
export function hashToken (token: string): string {
  return sha256(token);
}

/**
 * Constant-time comparison of two hex digests of equal length.
 *
 * @param a
 * @param b
 * @returns
 */
export function safeEqualHex (a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify that a raw token matches a stored hash, in constant time.
 *
 * @param token
 * @param tokenHash
 * @returns
 */
export function verifyToken (token: string, tokenHash: string): boolean {
  return safeEqualHex(sha256(token), tokenHash);
}

/** A freshly-minted opaque token and its at-rest hash. */
export interface TokenPair {
  token: string;
  tokenHash: string;
}

/**
 * Create a random token together with its storage hash.
 *
 * @param byteLength
 * @returns
 */
export function createTokenPair (byteLength = 32): TokenPair {
  const token = generateToken(byteLength);
  return { token, tokenHash: hashToken(token) };
}
