import { Resource } from 'resora'

/** A webhook endpoint (the signing secret is never serialised — shown once at creation). */
export default class WebhookEndpointResource extends Resource {
  data () {
    return {
      id: this.id,
      project_id: this.projectId,
      url: this.url,
      events: this.events,
      status: this.status,
      created_at: this.createdAt,
    }
  }
}
