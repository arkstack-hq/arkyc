import { Resource } from 'resora'

export default class ProjectResource extends Resource {
  data() {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      name: this.name,
      slug: this.slug,
      environment: this.environment,
      settings: this.settings ?? {},
      branding: this.branding ?? {},
      status: this.status,
      created_at: this.createdAt,
    }
  }
}
