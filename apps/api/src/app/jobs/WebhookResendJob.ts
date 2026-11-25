import { Job } from '@arkstack/jobs'
import { webhookService } from '@app/services/WebhookService'

/** Re-queues every failed delivery of a webhook endpoint (queue `queue.queues.webhook`). */
export class WebhookResendJob extends Job {
  override queue = config('queue.queues.webhook', 'webhook')
  override tries = 3
  override backoff = 30

  constructor(public endpointId: string) {
    super()
  }

  async handle(): Promise<void> {
    await webhookService.requeueFailed(this.endpointId)
  }
}
