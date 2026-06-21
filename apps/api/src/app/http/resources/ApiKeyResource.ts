import { Resource } from 'resora'

/** An API key — never includes the secret hash. */
export default class ApiKeyResource extends Resource {
  data() {
    return {
      id: this.id,
      name: this.name,
      key_prefix: this.keyPrefix,
      last_used_at: this.lastUsedAt ?? null,
      expires_at: this.expiresAt ?? null,
      revoked_at: this.revokedAt ?? null,
      created_at: this.createdAt,
    }
  }
}
