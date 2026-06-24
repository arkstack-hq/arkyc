import { Resource } from 'resora'

/**
 * Platform-admin organization detail: core fields and headline counts. The org's
 * projects are paginated separately (admin org-projects endpoint).
 */
export default class AdminOrganizationDetailResource extends Resource {
  data() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      logo_url: this.logoUrl ?? null,
      created_at: this.createdAt,
      counts: this.counts,
    }
  }
}
