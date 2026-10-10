import { Resource } from 'resora'
import { resolveBranding } from 'src/support/storage'

export default class ProjectResource extends Resource {
  async data() {
    return {
      id: this.id,
      organization_id: this.organizationId,
      name: this.name,
      slug: this.slug,
      environment: this.environment,
      settings: this.settings ?? {},
      branding: await resolveBranding(this.branding),
      status: this.status,
      has_ai_grant: this.hasAiGrant,
      created_at: this.createdAt,
    }
  }
}
