import type { Entity, Id, IsoDateTime, ProjectScoped } from './common'
import type { DecisionReason, VerificationStatus } from './verification'

/** The set of webhook event names Arkyc can deliver. */
export type WebhookEventName =
  | 'verification.started'
  | 'verification.document_submitted'
  | 'verification.processing'
  | 'verification.requires_review'
  | 'verification.approved'
  | 'verification.rejected'
  | 'verification.completed'
  | 'verification.expired'
  | 'verification.cancelled'

/** Per-check summary included in a webhook payload. */
export interface WebhookChecks {
  document?: {
    quality_score: number
    ocr_confidence: number
    expired: boolean
    /** Which parser produced the OCR fields: the MRZ, a custom parser, or the generic scraper. */
    ocr_parse_stage?: 'mrz' | 'custom' | 'generic'
  }
  liveness?: {
    passed: boolean
    score: number
  }
  face_match?: {
    passed: boolean
    similarity_score: number
  }
}

/** The JSON body delivered to a webhook endpoint. */
export interface WebhookEvent {
  event: WebhookEventName
  session_id: Id
  organization_id: Id
  project_id: Id
  user_reference: string | null
  status: VerificationStatus
  checks: WebhookChecks
  decision_reason: DecisionReason | null
  created_at: IsoDateTime
}

/** Webhook endpoint lifecycle status. */
export type WebhookEndpointStatus = 'active' | 'disabled'

/** A configured webhook endpoint for a project. */
export interface WebhookEndpoint extends Entity, ProjectScoped {
  url: string
  /** Hash of the signing secret; the raw secret is shown once at creation. */
  secret_hash: string
  events: WebhookEventName[]
  status: WebhookEndpointStatus
}

/** Delivery attempt state for a webhook. */
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed'

/** A record of a webhook delivery (and its retries). */
export interface WebhookDelivery extends Entity, ProjectScoped {
  webhook_endpoint_id: Id
  event: WebhookEventName
  payload: WebhookEvent
  status: WebhookDeliveryStatus
  response_status: number | null
  response_body: string | null
  attempts: number
  next_retry_at: IsoDateTime | null
}
