import type { WebhookEvent } from '@arkyc/types'
import { WebhookSigner, type VerifyWebhookInput } from '@arkyc/webhooks'
import { WebhookEndpoints } from './WebhookEndpoints'

type Request = (method: string, path: string, body?: unknown) => Promise<Record<string, unknown>>

/** Refuses endpoint calls on a standalone `new Webhooks()` (verification-only). */
const noClient: Request = async () => {
  throw new Error('Webhook endpoint management needs an Arkyc client: use `new Arkyc({ secretKey }).webhooks`.')
}

export class Webhooks {
  /**
   * Webhook endpoint management (list / retrieve / create / update) via the
   * Public Project API. Available on `arkyc.webhooks`.
   */
  readonly endpoints: WebhookEndpoints

  /**
   * @param request  The client's authenticated request (set by `Arkyc`). Omit it
   *                 for a verification-only instance.
   */
  constructor(request?: Request) {
    this.endpoints = new WebhookEndpoints(request ?? noClient)
  }

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
