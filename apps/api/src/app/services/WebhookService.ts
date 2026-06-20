import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  buildWebhookPayload,
  signWebhook,
} from '@arkyc/webhooks'
import { isDocumentExpired } from '@arkyc/core'
import type { VerificationStatus, WebhookChecks, WebhookEvent, WebhookEventName } from '@arkyc/types'
import { VerificationSession } from '@app/models/VerificationSession'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import { WebhookDelivery } from '@app/models/WebhookDelivery'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { OcrResult } from '@app/models/OcrResult'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { FaceMatchCheck } from '@app/models/FaceMatchCheck'
import { toArray } from 'src/support/collection'
import { queue } from './Queue'

/** Map a session status to the webhook event it emits (omitted = no event). */
const STATUS_EVENT: Partial<Record<VerificationStatus, WebhookEventName>> = {
  started: 'verification.started',
  document_submitted: 'verification.document_submitted',
  processing: 'verification.processing',
  requires_review: 'verification.requires_review',
  approved: 'verification.approved',
  rejected: 'verification.rejected',
  expired: 'verification.expired',
  cancelled: 'verification.cancelled',
}

/** Max delivery attempts before a webhook is given up on. */
const MAX_DELIVERY_ATTEMPTS = 5

/**
 * Webhook fan-out + delivery (Phase 10). On a session status change it creates a
 * `WebhookDelivery` per subscribed endpoint and enqueues a `webhook` job; the
 * delivery worker signs and POSTs the payload, recording the outcome with
 * retries/backoff.
 */
export class WebhookService {
  /** Emit the event(s) for a status change to all subscribed, active endpoints. */
  async onStatusChange (session: VerificationSession, status: VerificationStatus): Promise<void> {
    const event = STATUS_EVENT[status]
    if (!event) return

    await this.dispatch(session, event)
    // A terminal auto/manual decision also emits `verification.completed`.
    if (status === 'approved' || status === 'rejected') {
      await this.dispatch(session, 'verification.completed')
    }
  }

  /** Create + enqueue a delivery for each active endpoint subscribed to `event`. */
  async dispatch (session: VerificationSession, event: WebhookEventName): Promise<void> {
    const endpoints = toArray(
      await WebhookEndpoint.where({ projectId: session.projectId, status: 'active' }).get(),
    ).filter((endpoint) => endpoint.events.includes(event))
    if (endpoints.length === 0) return

    const payload = await this.buildPayload(session, event)
    for (const endpoint of endpoints) {
      const delivery = await WebhookDelivery.create({
        tenantId: session.tenantId,
        projectId: session.projectId,
        webhookEndpointId: endpoint.id,
        event,
        payload,
        status: 'pending',
        attempts: 0,
        nextRetryAt: null,
      })
      await queue.enqueue('webhook', { deliveryId: delivery.id }, { maxAttempts: MAX_DELIVERY_ATTEMPTS })
    }
  }

  /**
   * Sign + POST a delivery's stored payload to its endpoint and record the
   * outcome. Throws on non-2xx / transport error so the queue retries (the
   * delivery row mirrors the latest attempt).
   */
  async deliver (deliveryId: string): Promise<void> {
    const delivery = await WebhookDelivery.where({ id: deliveryId }).first()
    if (!delivery || delivery.status === 'delivered') return

    const endpoint = await WebhookEndpoint.where({ id: delivery.webhookEndpointId }).first()
    if (!endpoint || endpoint.status !== 'active') return

    const body = JSON.stringify(delivery.payload)
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = signWebhook(body, endpoint.secretHash, timestamp)

    delivery.attempts += 1
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [SIGNATURE_HEADER]: signature,
          [TIMESTAMP_HEADER]: String(timestamp),
        },
        body,
      })
      const text = await res.text().catch(() => '')
      delivery.responseStatus = res.status
      delivery.responseBody = text.slice(0, 2000)

      if (res.ok) {
        delivery.status = 'delivered'
        delivery.nextRetryAt = null
        await delivery.save()
        return
      }

      delivery.status = 'failed'
      await delivery.save()
      throw new Error(`Webhook delivery failed with status ${res.status}`)
    } catch (error) {
      delivery.status = 'failed'
      delivery.responseBody ??= error instanceof Error ? error.message : String(error)
      await delivery.save()
      throw error
    }
  }

  /** Build + persist a one-off test delivery for an endpoint, then enqueue it. */
  async sendTest (endpoint: WebhookEndpoint): Promise<WebhookDelivery> {
    const payload = buildWebhookPayload({
      event: 'verification.completed',
      sessionId: '00000000-0000-0000-0000-000000000000',
      tenantId: endpoint.tenantId,
      projectId: endpoint.projectId,
      userReference: 'test',
      status: 'approved',
      checks: {},
      decisionReason: 'AUTO_APPROVED',
      createdAt: new Date().toISOString(),
    })
    const delivery = await WebhookDelivery.create({
      tenantId: endpoint.tenantId,
      projectId: endpoint.projectId,
      webhookEndpointId: endpoint.id,
      event: 'verification.completed',
      payload,
      status: 'pending',
      attempts: 0,
      nextRetryAt: null,
    })
    await queue.enqueue('webhook', { deliveryId: delivery.id }, { maxAttempts: MAX_DELIVERY_ATTEMPTS })

    return delivery
  }

  /** Build the event payload, gathering the latest per-check summaries. */
  async buildPayload (session: VerificationSession, event: WebhookEventName): Promise<WebhookEvent> {
    return buildWebhookPayload({
      event,
      sessionId: session.id,
      tenantId: session.tenantId,
      projectId: session.projectId,
      userReference: session.userReference,
      status: session.status,
      checks: await this.checks(session),
      decisionReason: session.decisionReason,
      createdAt: new Date().toISOString(),
    })
  }

  private async checks (session: VerificationSession): Promise<WebhookChecks> {
    const checks: WebhookChecks = {}

    const capture = await DocumentCapture.where({ sessionId: session.id }).first()
    const ocr = await OcrResult.where({ sessionId: session.id }).first()
    if (capture || ocr) {
      checks.document = {
        quality_score: capture?.qualityScore ?? 0,
        ocr_confidence: ocr?.confidence ?? 0,
        expired: ocr ? isDocumentExpired(ocr.fields.expiryDate, new Date()) : false,
      }
    }

    const liveness = await LivenessCheck.where({ sessionId: session.id }).first()
    if (liveness) checks.liveness = { passed: liveness.passed, score: liveness.score }

    const faceMatch = await FaceMatchCheck.where({ sessionId: session.id }).first()
    if (faceMatch) checks.face_match = { passed: faceMatch.passed, similarity_score: faceMatch.similarityScore }

    return checks
  }
}

/** Shared singleton webhook service. */
export const webhookService = new WebhookService()
