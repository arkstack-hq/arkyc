import { Job } from '@arkstack/jobs'
import { webhookService } from '@app/services/WebhookService'

/**
 * Webhook job (queue `queue.queues.webhook`): signs + POSTs a pending delivery to its
 * endpoint. `deliver` throws on failure so the queue retries with backoff; the
 * `webhook_deliveries` row records each attempt's outcome.
 */
/** Delivery attempts before a webhook delivery is given up on. */
export const WEBHOOK_MAX_ATTEMPTS = 5

export class WebhookJob extends Job {
  override queue = config('queue.queues.webhook', 'webhook')
  override tries = WEBHOOK_MAX_ATTEMPTS
  override backoff = 10

  constructor(public deliveryId: string) {
    super()
  }

  async handle(): Promise<void> {
    await webhookService.deliver(this.deliveryId)
  }
}
