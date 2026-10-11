import type { WebhookEvent } from '@arkyc/types'
import { WebhookSigner, type VerifyWebhookInput } from '@arkyc/webhooks'

export class Webhooks {
  /**
   * Verify a received webhook signature against the endpoint's signing secret.
   *
   * @param input
   * @returns
   */
  verify(input: VerifyWebhookInput): boolean {
    return WebhookSigner.verify(input)
  }

  /**
   * Verify a received webhook and parse its typed payload. Throws when the
   * signature doesn't match.
   *
   * @param input
   * @returns
   */
  constructEvent(input: VerifyWebhookInput): WebhookEvent {
    if (!WebhookSigner.verify(input)) throw new Error('Invalid Arkyc webhook signature')

    return JSON.parse(input.payload) as WebhookEvent
  }
}
