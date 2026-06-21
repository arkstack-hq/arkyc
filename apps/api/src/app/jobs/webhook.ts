import { webhookService } from '@app/services/WebhookService'

export interface WebhookJobPayload {
  deliveryId: string
}

/**
 * Webhook worker (queue `webhook`): signs + POSTs a pending delivery to its
 * endpoint. Throws on failure so the queue retries with backoff; the
 * `webhook_deliveries` row records each attempt's outcome.
 */
export async function webhookJob(payload: WebhookJobPayload): Promise<void> {
  await webhookService.deliver(payload.deliveryId)
}
