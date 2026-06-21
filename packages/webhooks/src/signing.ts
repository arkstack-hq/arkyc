import { createHmac, timingSafeEqual } from 'node:crypto'

/** Inputs for verifying a received webhook signature. */
export interface VerifyWebhookInput {
  /** Raw request body as received. */
  payload: string
  /** The endpoint's signing secret. */
  secret: string
  /** Signature from the `X-Arkyc-Signature` header. */
  signature: string
  /** Timestamp from the `X-Arkyc-Timestamp` header (unix seconds). */
  timestamp: number
  /** Allowed clock skew in seconds (default 300). */
  toleranceSec?: number
  /** Injected clock (epoch ms) — pure + testable. */
  now?: number
}

/**
 * Sign and verify webhook deliveries (HMAC-SHA256, Stripe-style).
 */
export class WebhookSigner {
  /** Header carrying the HMAC signature on a delivered webhook. */
  static readonly SIGNATURE_HEADER = 'X-Arkyc-Signature'

  /** Header carrying the unix-seconds timestamp the signature covers. */
  static readonly TIMESTAMP_HEADER = 'X-Arkyc-Timestamp'

  /** Default tolerance (seconds) for the timestamp when verifying. */
  static readonly DEFAULT_TOLERANCE_SEC = 300

  /**
   * Compute the HMAC-SHA256 signature for a webhook body.
   *
   * The signed message is `${timestamp}.${payload}` (Stripe-style), so a captured
   * body can't be replayed under a different timestamp.
   *
   * @param payload    The exact JSON string that will be sent as the body.
   * @param secret     The endpoint's signing secret.
   * @param timestamp  Unix seconds the signature is bound to.
   */
  static sign(payload: string, secret: string, timestamp: number): string {
    return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  }

  /**
   * Verify a webhook signature and reject stale/forged deliveries: the timestamp
   * must be within tolerance and the HMAC must match (constant-time compare).
   *
   * @param input
   * @returns
   */
  static verify(input: VerifyWebhookInput): boolean {
    const tolerance = input.toleranceSec ?? WebhookSigner.DEFAULT_TOLERANCE_SEC
    const nowSec = Math.floor((input.now ?? Date.now()) / 1000)
    if (!Number.isFinite(input.timestamp)) return false
    if (Math.abs(nowSec - input.timestamp) > tolerance) return false

    const expected = WebhookSigner.sign(input.payload, input.secret, input.timestamp)
    const a = Buffer.from(input.signature)
    const b = Buffer.from(expected)

    return a.length === b.length && timingSafeEqual(a, b)
  }
}
