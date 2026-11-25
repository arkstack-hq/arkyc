import { Resource } from 'resora'
import type { WebhookEndpoint } from '@app/models/WebhookEndpoint'

/** A webhook endpoint. The full signing secret is only returned at creation and rotation. */
export default class WebhookEndpointResource extends Resource {
  data() {
    return {
      id: this.id,
      project_id: this.projectId,
      url: this.url,
      secret_hint: (this.resource as WebhookEndpoint).secretHint(),
      events: this.events,
      status: this.status,
      created_at: this.createdAt,
    }
  }
}
