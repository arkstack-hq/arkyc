import { Resource } from 'resora'

export default class TenantResource extends Resource {
  data() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      logo_url: this.logoUrl ?? null,
      settings: this.settings ?? {},
      created_at: this.createdAt,
    }
  }
}
