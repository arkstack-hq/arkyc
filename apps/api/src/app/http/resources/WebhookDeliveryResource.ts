import { Resource } from 'resora'

/** A webhook delivery and the outcome of its latest attempt (the payload is omitted). */
export default class WebhookDeliveryResource extends Resource {
  data() {
    return {
      id: this.id,
      project_id: this.projectId,
      webhook_endpoint_id: this.webhookEndpointId,
      event: this.event,
      session_id: this.payload?.session_id ?? null,
      status: this.status,
      response_status: this.responseStatus,
      response_body: this.responseBody,
      attempts: this.attempts,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    }
  }
}
