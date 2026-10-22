import {
  workflowScreeningConfig,
  type VerificationStatus,
  type WebhookChecks,
  type WebhookEndpointStatus,
  type WebhookEvent,
  type WebhookEventName,
} from '@arkyc/types'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { WebhookPayload, WebhookSigner } from '@arkyc/webhooks'

import { AddressVerification } from '@app/models/AddressVerification'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { FaceMatchCheck } from '@app/models/FaceMatchCheck'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { OcrResult } from '@app/models/OcrResult'
import { SessionRiskSignal } from '@app/models/SessionRiskSignal'
import { SessionRules } from '@arkyc/core'
import { VerificationSession } from '@app/models/VerificationSession'
import { WebhookDelivery } from '@app/models/WebhookDelivery'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import { WebhookJob } from '@app/jobs'
import { WEBHOOK_MAX_ATTEMPTS } from '@app/jobs/WebhookJob'
import { webhookNotifications } from '@app/notifications/WebhookNotifications'
import { buildSessionAssets } from '@app/services/SessionAssetService'
import { screeningHits } from '@app/services/risk/types'
import { toArray } from 'src/support/collection'
import { decryptSecret, encryptSecret } from 'src/support/secret-cipher'

/**
 * Read the OCR parse stage from a stored driver `rawResponse`, if present.
 *
 * @param raw
 * @returns
 */
function ocrParseStage(raw: unknown): 'mrz' | 'custom' | 'generic' | undefined {
  if (raw && typeof raw === 'object' && 'stage' in raw) {
    const stage = (raw as { stage?: unknown }).stage

    if (stage === 'mrz' || stage === 'custom' || stage === 'generic') return stage
  }

  return undefined
}

/**
 * Hard ceiling on a single outbound delivery attempt. Without it a slow or dead
 * endpoint blocks the caller indefinitely — and on a `sync` queue the delivery
 * runs inline in the triggering HTTP request (e.g. the webhook "test" button), so
 * an unbounded fetch hangs that request until the reverse proxy 504s (which the
 * browser then surfaces as a bogus CORS error). 10s stays well under a typical
 * 60s proxy read timeout, so the request always returns a real response instead.
 */
const DELIVERY_TIMEOUT_MS = 10_000

/** The session id carried by test deliveries. */
const TEST_SESSION_ID = '00000000-0000-0000-0000-000000000000'

/** Map a session status to the webhook event it emits (omitted = no event). */
const STATUS_EVENT: Partial<Record<VerificationStatus, WebhookEventName>> = {
  started: 'verification.started',
  document_submitted: 'verification.document_submitted',
  address_submitted: 'verification.address_submitted',
  processing: 'verification.processing',
  requires_review: 'verification.requires_review',
  approved: 'verification.approved',
  rejected: 'verification.rejected',
  expired: 'verification.expired',
  cancelled: 'verification.cancelled',
}

/**
 * Webhook fan-out + delivery (Phase 10). On a session status change it creates a
 * `WebhookDelivery` per subscribed endpoint and enqueues a `webhook` job; the
 * delivery worker signs and POSTs the payload, recording the outcome with
 * retries/backoff.
 */
export class WebhookService {
  /** Emit the event(s) for a status change to all subscribed, active endpoints. */
  async onStatusChange(session: VerificationSession, status: VerificationStatus): Promise<void> {
    const event = STATUS_EVENT[status]

    if (!event) return

    await this.dispatch(session, event)
    // A terminal auto/manual decision also emits `verification.completed`.
    if (status === 'approved' || status === 'rejected') {
      await this.dispatch(session, 'verification.completed')
    }
  }

  /**
   * Create + enqueue a delivery for each active endpoint subscribed to `event`.
   *
   * @param session
   * @param event
   * @returns
   */
  async dispatch(session: VerificationSession, event: WebhookEventName): Promise<void> {
    const endpoints = toArray(
      await WebhookEndpoint.where({ projectId: session.projectId, status: 'active' }).get(),
    ).filter((endpoint) => endpoint.events.includes(event))

    if (endpoints.length === 0) return

    const payload = await this.buildPayload(session, event)

    for (const endpoint of endpoints) {
      const delivery = await WebhookDelivery.create({
        organizationId: session.organizationId,
        projectId: session.projectId,
        webhookEndpointId: endpoint.id,
        event,
        payload,
        status: 'pending',
        attempts: 0,
        nextRetryAt: null,
      })

      try {
        await WebhookJob.dispatch(delivery.id)
      } catch {
        /* recorded on the delivery row; a worker retries it */
      }
    }
  }

  /**
   * Sign + POST a delivery's stored payload to its endpoint and record the
   * outcome. Throws on non-2xx / transport error so the queue retries (the
   * delivery row mirrors the latest attempt).
   *
   * @param deliveryId
   * @returns
   */
  async deliver(deliveryId: string): Promise<void> {
    const delivery = await WebhookDelivery.where({ id: deliveryId }).first()

    if (!delivery || delivery.status === 'delivered') return

    const endpoint = await WebhookEndpoint.where({ id: delivery.webhookEndpointId }).first()

    if (!endpoint || endpoint.status !== 'active') return

    const body = JSON.stringify(delivery.payload)
    const timestamp = Math.floor(Date.now() / 1000)
    // Secrets are stored encrypted-at-rest; decrypt only here, at sign time.
    // Legacy plaintext rows pass through unchanged (see `decryptSecret`).
    const signature = WebhookSigner.sign(body, decryptSecret(endpoint.secretHash), timestamp)

    delivery.attempts += 1
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [WebhookSigner.SIGNATURE_HEADER]: signature,
          [WebhookSigner.TIMESTAMP_HEADER]: String(timestamp),
        },
        body,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
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

      if (delivery.attempts >= WEBHOOK_MAX_ATTEMPTS && delivery.payload?.session_id !== TEST_SESSION_ID) {
        await webhookNotifications.failing(endpoint, delivery)
      }

      throw error
    }
  }

  /**
   * Build + persist a one-off test delivery for an endpoint, then enqueue it.
   *
   * @param endpoint
   * @returns
   */
  /**
   * Register an endpoint for a project. The signing secret is generated here and
   * returned exactly once in plaintext; it is persisted encrypted at rest and only
   * decrypted at sign time (the column keeps its `secret_hash` name).
   */
  async createEndpoint(
    owner: { organizationId: string; projectId: string },
    input: { url: string; events: WebhookEventName[] },
  ): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
    const secret = `whsec_${randomBytes(24).toString('hex')}`
    const endpoint = await WebhookEndpoint.create({
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      url: input.url,
      secretHash: encryptSecret(secret),
      events: input.events,
      status: 'active',
    })

    return { endpoint, secret }
  }

  /**
   * Update an endpoint's url / events / status. Only supplied fields change; the
   * signing secret never does, so receivers keep verifying deliveries.
   */
  async updateEndpoint(
    endpoint: WebhookEndpoint,
    input: { url?: string | null; events?: WebhookEventName[] | null; status?: WebhookEndpointStatus | null },
  ): Promise<WebhookEndpoint> {
    if (input.url) endpoint.url = input.url

    if (input.events) endpoint.events = input.events

    if (input.status) endpoint.status = input.status
    await endpoint.save()

    return endpoint
  }

  /**
   * The project's endpoint whose signing secret is `secret`, or `null`. Secrets
   * are encrypted with a random IV (not deterministic), so they can't be queried
   * for: each of the project's endpoints is decrypted and compared in constant
   * time. Projects hold a handful of endpoints, so this stays cheap.
   */
  async findEndpointBySecret(projectId: string, secret: string): Promise<WebhookEndpoint | null> {
    const candidate = Buffer.from(secret)
    const endpoints = toArray(await WebhookEndpoint.where({ projectId }).get())

    return (
      endpoints.find((endpoint) => {
        const stored = Buffer.from(decryptSecret(endpoint.secretHash))

        return stored.length === candidate.length && timingSafeEqual(stored, candidate)
      }) ?? null
    )
  }

  async sendTest(endpoint: WebhookEndpoint): Promise<WebhookDelivery> {
    const payload = WebhookPayload.build({
      event: 'verification.completed',
      sessionId: TEST_SESSION_ID,
      organizationId: endpoint.organizationId,
      projectId: endpoint.projectId,
      userReference: 'test',
      status: 'approved',
      checks: {},
      decisionReason: 'AUTO_APPROVED',
      createdAt: new Date().toISOString(),
    })
    const delivery = await WebhookDelivery.create({
      organizationId: endpoint.organizationId,
      projectId: endpoint.projectId,
      webhookEndpointId: endpoint.id,
      event: 'verification.completed',
      payload,
      status: 'pending',
      attempts: 0,
      nextRetryAt: null,
    })

    // On an async queue this just enqueues; on a `sync` queue it runs the delivery
    // inline and rethrows if the endpoint is unreachable. Swallow that here (as
    // `dispatch` does) so a dead/slow test target doesn't 500 the request — the
    // attempt's outcome is recorded on the delivery row either way.
    try {
      await WebhookJob.dispatch(delivery.id)
    } catch {
      /* recorded on the delivery row; async queues retry, sync does not */
    }

    return delivery
  }

  /**
   * Build the event payload, gathering the latest per-check summaries.
   *
   * @param session
   * @param event
   * @returns
   */
  async buildPayload(session: VerificationSession, event: WebhookEventName): Promise<WebhookEvent> {
    return WebhookPayload.build({
      event,
      sessionId: session.id,
      organizationId: session.organizationId,
      projectId: session.projectId,
      userReference: session.userReference,
      status: session.status,
      checks: await this.checks(session),
      decisionReason: session.decisionReason,
      assets: await buildSessionAssets(session),
      createdAt: new Date().toISOString(),
    })
  }

  private async checks(session: VerificationSession): Promise<WebhookChecks> {
    const checks: WebhookChecks = {}

    const capture = await DocumentCapture.where({ sessionId: session.id }).first()
    const ocr = await OcrResult.where({ sessionId: session.id }).first()

    if (capture || ocr) {
      checks.document = {
        quality_score: capture?.qualityScore ?? 0,
        ocr_confidence: ocr?.confidence ?? 0,
        expired: ocr ? SessionRules.isDocumentExpired(ocr.fields.expiryDate, new Date()) : false,
        ocr_parse_stage: ocrParseStage(ocr?.rawResponse),
      }
    }

    const liveness = await LivenessCheck.where({ sessionId: session.id }).first()

    if (liveness) checks.liveness = { passed: liveness.passed, score: liveness.score }

    const faceMatch = await FaceMatchCheck.where({ sessionId: session.id }).first()

    if (faceMatch) checks.face_match = { passed: faceMatch.passed, similarity_score: faceMatch.similarityScore }

    const address = await AddressVerification.where({ sessionId: session.id }).first()

    if (address) {
      checks.address = {
        passed: address.passed,
        score: address.score,
        methods: address.methods.map((m) => m.method),
      }
    }

    const signals = toArray(
      await SessionRiskSignal.where({ sessionId: session.id }).orderBy({ createdAt: 'asc' }).limit(100).get(),
    )

    if (signals.length || session.riskScore != null) {
      checks.risk = {
        score: session.riskScore ?? null,
        signals: signals.map((signal) => ({ key: signal.key, severity: signal.severity, cleared: !!signal.clearedAt })),
      }
    }

    const hits = screeningHits(signals.filter((signal) => !signal.clearedAt).map((signal) => signal.toSignal()))

    if (workflowScreeningConfig(session.workflow) || hits.length) {
      checks.screening = { hits }
    }

    return checks
  }
}

/**
 * Shared singleton webhook service.
 */
export const webhookService = new WebhookService()
