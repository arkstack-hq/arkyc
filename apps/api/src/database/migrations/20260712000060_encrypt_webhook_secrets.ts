import { Migration, SchemaBuilder } from 'arkormx'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import { encryptSecret, isEncryptedSecret } from 'src/support/secret-cipher'
import { toArray } from 'src/support/collection'

/**
 * Encrypt-at-rest existing webhook signing secrets (Phase 20 hardening). The
 * `secret_hash` column historically held the raw `whsec_…` value; wrap each in an
 * `enc:v1:` envelope. Data-only (no schema change), idempotent (already-encrypted
 * rows are skipped), and safe to interleave with running signers — `decryptSecret`
 * reads legacy plaintext unchanged, so any row this misses keeps signing.
 */
export default class EncryptWebhookSecretsMigration extends Migration {
  public async up(_schema: SchemaBuilder): Promise<void> {
    const endpoints = toArray(await WebhookEndpoint.all())
    for (const endpoint of endpoints) {
      if (isEncryptedSecret(endpoint.secretHash)) continue
      endpoint.secretHash = encryptSecret(endpoint.secretHash)
      await endpoint.save()
    }
  }

  public async down(_schema: SchemaBuilder): Promise<void> {
    // No reversal: the encrypted form is backward-compatible, and decrypting back
    // to plaintext would only weaken at-rest security.
  }
}
