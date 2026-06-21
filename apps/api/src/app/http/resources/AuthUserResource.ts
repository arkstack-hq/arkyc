import { Resource } from 'resora'

/** The authenticated user, safe for client consumption (no credentials). */
export default class AuthUserResource extends Resource {
  data() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatar_url: this.avatarUrl ?? null,
      last_login_at: this.lastLoginAt ?? null,
      created_at: this.createdAt,
    }
  }
}
