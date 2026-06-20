import { generateToken, safeEqualHex, sha256 } from './tokens.js';

/** Environment marker embedded in an API key (`sk_live_…` / `sk_test_…`). */
export type ApiKeyEnvironment = 'live' | 'test';

/** A newly-generated API key: the one-time secret plus its stored fields. */
export interface GeneratedApiKey {
  /** Full secret shown to the integrator exactly once, e.g. `sk_live_…`. */
  secret: string;
  /** Stored, human-identifiable prefix (also used for fast lookup). */
  keyPrefix: string;
  /** SHA-256 hash of the secret, stored in `api_keys.key_hash`. */
  keyHash: string;
}

/** Number of leading characters of the secret retained as the lookup prefix. */
const PREFIX_LENGTH = 12;

/**
 * Generate a project API key.
 *
 * The secret has the form `sk_<env>_<random>`. Only `keyPrefix` and `keyHash`
 * should be persisted; `secret` is returned to the caller once and never stored.
 *
 * @param environment
 * @returns
 */
export function generateApiKey (environment: ApiKeyEnvironment = 'live'): GeneratedApiKey {
  const secret = `sk_${environment}_${generateToken(24)}`;
  return {
    secret,
    keyPrefix: secret.slice(0, PREFIX_LENGTH),
    keyHash: sha256(secret),
  };
}

/**
 * Derive the lookup prefix from a full secret (e.g. for incoming requests).
 *
 * @param secret
 * @returns
 */
export function apiKeyPrefix (secret: string): string {
  return secret.slice(0, PREFIX_LENGTH);
}

/**
 * Hash an API key secret for comparison against a stored `key_hash`.
 *
 * @param secret
 * @returns
 */
export function hashApiKey (secret: string): string {
  return sha256(secret);
}

/**
 * Verify a presented API key secret against a stored hash, in constant time.
 *
 * @param secret
 * @param keyHash
 * @returns
 */
export function verifyApiKey (secret: string, keyHash: string): boolean {
  return safeEqualHex(sha256(secret), keyHash);
}
