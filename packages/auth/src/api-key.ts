import { Token } from './tokens'

/** Environment marker embedded in an API key (`sk_live_…` / `sk_test_…`). */
export type ApiKeyEnvironment = 'live' | 'test'

/** A newly-generated API key: the one-time secret plus its stored fields. */
export interface GeneratedApiKey {
  /** Full secret shown to the integrator exactly once, e.g. `sk_live_…`. */
  secret: string
  /** Stored, human-identifiable prefix (also used for fast lookup). */
  keyPrefix: string
  /** SHA-256 hash of the secret, stored in `api_keys.key_hash`. */
  keyHash: string
}

/** Number of leading characters of the secret retained as the lookup prefix. */
const PREFIX_LENGTH = 12

/** Project API key generation, prefixing, hashing, and verification. */
export class ApiKey {
  /**
   * Generate a project API key.
   *
   * The secret has the form `sk_<env>_<random>`. Only `keyPrefix` and `keyHash`
   * should be persisted; `secret` is returned to the caller once and never stored.
   *
   * @param environment
   * @returns
   */
  static generate(environment: ApiKeyEnvironment = 'live'): GeneratedApiKey {
    const secret = `sk_${environment}_${Token.generate(24)}`
    return {
      secret,
      keyPrefix: secret.slice(0, PREFIX_LENGTH),
      keyHash: Token.sha256(secret),
    }
  }

  /**
   * Derive the lookup prefix from a full secret (e.g. for incoming requests).
   *
   * @param secret
   * @returns
   */
  static prefix(secret: string): string {
    return secret.slice(0, PREFIX_LENGTH)
  }

  /**
   * Hash an API key secret for comparison against a stored `key_hash`.
   *
   * @param secret
   * @returns
   */
  static hash(secret: string): string {
    return Token.sha256(secret)
  }

  /**
   * Verify a presented API key secret against a stored hash, in constant time.
   *
   * @param secret
   * @param keyHash
   * @returns
   */
  static verify(secret: string, keyHash: string): boolean {
    return Token.safeEqualHex(Token.sha256(secret), keyHash)
  }
}
