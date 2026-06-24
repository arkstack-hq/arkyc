import { Resource } from 'resora'

type Related = { getAttribute(key: string): unknown } | null | undefined

/** A project in the admin organization view, carrying its AI-processing status. */
export default class AdminProjectResource extends Resource {
  data() {
    const grant = this.resource.getAttribute('aiProcessingGrant') as Related

    return {
      id: this.id,
      name: this.name,
      environment: this.environment,
      status: this.status,
      ai_access: {
        status: (grant?.getAttribute('status') as string) ?? 'none',
        requested_at: grant?.getAttribute('requestedAt') ?? null,
        reviewed_at: grant?.getAttribute('reviewedAt') ?? null,
      },
    }
  }
}
