import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'

import { promisify } from 'node:util'

interface ScryptOptions {
  N: number
  maxmem: number
}

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

/** scrypt cost parameter (2^14). Memory use ≈ 128 · N · r bytes. */
const COST = 1 << 14
const KEY_LENGTH = 64
const SALT_BYTES = 16
/** Headroom above the ~16MB needed at COST so Node never rejects on memory. */
const MAXMEM = 64 * 1024 * 1024
const PREFIX = 'scrypt'

/**
 * Password hashing and verification helpers built on scrypt.
 */
export class Password {
  /**
   * Hash a plaintext password using scrypt.
   *
   * Returns a self-describing string: `scrypt$<cost>$<saltBase64>$<hashBase64>`,
   * so {@link Password.verify} needs no external parameters.
   *
   * @param password
   * @returns
   */
  static async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES)
    const derived = await scrypt(password, salt, KEY_LENGTH, { N: COST, maxmem: MAXMEM })
    return [PREFIX, COST, salt.toString('base64'), derived.toString('base64')].join('$')
  }

  /**
   * Verify a plaintext password against a {@link Password.hash} digest.
   *
   * @param password
   * @param stored
   * @returns
   */
  static async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$')
    if (parts.length !== 4 || parts[0] !== PREFIX) return false

    const cost = Number(parts[1])
    const salt = Buffer.from(parts[2]!, 'base64')
    const expected = Buffer.from(parts[3]!, 'base64')
    if (!Number.isInteger(cost) || cost < 2 || salt.length === 0 || expected.length === 0) {
      return false
    }

    const derived = await scrypt(password, salt, expected.length, { N: cost, maxmem: MAXMEM })
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  }
}
