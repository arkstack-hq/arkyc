import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** A freshly-minted opaque token and its at-rest hash. */
export interface TokenPair {
  token: string
  tokenHash: string
}

/**
 * Opaque token generation, hashing, and constant-time verification.
 */
export class Token {
  /**
   * Generate a cryptographically-random, URL-safe opaque token.
   *
   * @param byteLength Entropy in bytes (default 32 → ~43-char base64url string).
   *
   * @param byteLength
   * @returns
   */
  static generate(byteLength = 32): string {
    return randomBytes(byteLength).toString('base64url')
  }

  /**
   * SHA-256 hex digest of a value. Used to store hashes of opaque secrets.
   *
   * @param value
   * @returns
   */
  static sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  /**
   * Hash an opaque token for at-rest storage (e.g. `token_hash` columns).
   *
   * @param token
   * @returns
   */
  static hash(token: string): string {
    return Token.sha256(token)
  }

  /**
   * Constant-time comparison of two hex digests of equal length.
   *
   * @param a
   * @param b
   * @returns
   */
  static safeEqualHex(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    const bufA = Buffer.from(a, 'hex')
    const bufB = Buffer.from(b, 'hex')
    if (bufA.length !== bufB.length || bufA.length === 0) return false
    return timingSafeEqual(bufA, bufB)
  }

  /**
   * Verify that a raw token matches a stored hash, in constant time.
   *
   * @param token
   * @param tokenHash
   * @returns
   */
  static verify(token: string, tokenHash: string): boolean {
    return Token.safeEqualHex(Token.sha256(token), tokenHash)
  }

  /**
   * Create a random token together with its storage hash.
   *
   * @param byteLength
   * @returns
   */
  static createPair(byteLength = 32): TokenPair {
    const token = Token.generate(byteLength)
    return { token, tokenHash: Token.hash(token) }
  }
}
