import { Resource } from 'resora'

/** An organization-scoped verification workflow. */
export default class WorkflowResource extends Resource {
  data() {
    return {
      id: this.id,
      organization_id: this.organizationId,
      name: this.name,
      steps: this.steps,
      options: this.options,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    }
  }
}
