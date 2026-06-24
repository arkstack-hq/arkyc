import { Resource } from 'resora'

export default class ProjectResource extends Resource {
  data() {
    return {
      id: this.id,
      organization_id: this.organizationId,
      name: this.name,
      slug: this.slug,
      environment: this.environment,
      settings: this.settings ?? {},
      branding: this.branding ?? {},
      status: this.status,
      has_ai_grant: this.hasAiGrant,
      created_at: this.createdAt,
    }
  }
}
