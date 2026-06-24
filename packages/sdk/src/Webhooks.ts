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
}
