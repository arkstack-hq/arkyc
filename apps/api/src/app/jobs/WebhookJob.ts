import { Job } from '@arkstack/jobs'
import { webhookService } from '@app/services/WebhookService'

/**
 * Webhook job (queue `webhook`): signs + POSTs a pending delivery to its
 * endpoint. `deliver` throws on failure so the queue retries with backoff; the
 * `webhook_deliveries` row records each attempt's outcome.
 */
export class WebhookJob extends Job {
  override queue = 'webhook'
  override tries = 5
  override backoff = 10

  constructor(public deliveryId: string) {
    super()
  }

  async handle(): Promise<void> {
    await webhookService.deliver(this.deliveryId)
  }
}
