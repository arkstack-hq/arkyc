import { Encryption } from '@arkstack/common'

/**
 * Encrypt-at-rest for secrets that must stay recoverable — notably webhook
 * signing secrets, which are re-read to HMAC-sign every delivery (so a one-way
 * hash is not an option). Delegates to the framework's `Encryption` (AES-GCM,
 * keyed by the unified `APP_KEY`). This wrapper only adds backward-compatibility
 * for secrets written before encryption existed, which sit in the column as
 * plaintext until the re-encrypt migration runs.
 *
 * `Encryption` throws when `APP_KEY` is unset — set a strong, stable key
 * (`ark key:generate`); rotating it makes existing ciphertext undecryptable.
 */

/**
 * Encrypt a secret for storage.
 *
 * @param plaintext
 * @returns
 */
export function encryptSecret(plaintext: string): string {
  return Encryption.encrypt(plaintext)
}

/**
 * Decrypt a stored secret. A legacy plaintext value (written before encryption,
 * so not a valid `Encryption` payload) fails to decrypt and is returned
 * unchanged, so signing keeps working until the re-encrypt migration runs.
 *
 * @param value
 * @returns
 */
export function decryptSecret(value: string): string {
  try {
    return Encryption.decrypt(value)
  } catch {
    return value
  }
}

/**
 * Whether a stored value is already an `Encryption` payload (vs legacy plaintext).
 *
 * @param value
 * @returns
 */
export function isEncryptedSecret(value: string): boolean {
  try {
    Encryption.decrypt(value)

    return true
  } catch {
    return false
  }
}
