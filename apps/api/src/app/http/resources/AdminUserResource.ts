import { Resource } from 'resora'

type Related = { getAttribute(key: string): unknown } | null | undefined

/**
 * A platform user, for the admin users surface. `is_admin` is derived from the
 * eager-loaded `adminPermissions` relation (any grant ⇒ admin).
 */
export default class AdminUserResource extends Resource {
  data() {
    const grants = this.resource.getAttribute('adminPermissions') as Iterable<Related> | undefined
    const isAdmin = grants ? Array.from(grants).length > 0 : false

    return {
      id: this.id,
      name: this.name,
      email: this.email,
      status: this.status ?? 'active',
      last_login_at: this.lastLoginAt ?? null,
      email_verified_at: this.emailVerifiedAt ?? null,
      created_at: this.createdAt,
      is_admin: isAdmin,
    }
  }
}
