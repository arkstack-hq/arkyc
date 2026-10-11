import { Resource } from 'resora'

/** An invitation addressed to the signed-in user. */
export default class PendingInvitationResource extends Resource {
  data() {
    const relation = (name: string) =>
      (this.resource as { getAttribute(key: string): unknown }).getAttribute(name) as
        | { getAttribute(key: string): string }
        | null
        | undefined
    const organization = relation('organization')
    const role = relation('role')

    return {
      id: this.id,
      organization: organization
        ? {
            id: organization.getAttribute('id'),
            name: organization.getAttribute('name'),
            slug: organization.getAttribute('slug'),
          }
        : null,
      role: role ? { id: role.getAttribute('id'), name: role.getAttribute('name') } : null,
      expires_at: this.expiresAt,
      created_at: this.createdAt,
    }
  }
}
