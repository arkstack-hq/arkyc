import type { Entity, Id, IsoDateTime, Metadata, ProjectScoped } from './common'

/** The lifecycle state of a verification session. */
export type VerificationStatus =
  | 'pending'
  | 'started'
  | 'document_submitted'
  | 'liveness_submitted'
  | 'processing'
  | 'requires_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled'

/** The outcome of the decision engine (or a manual review). */
export type VerificationDecision = 'approved' | 'requires_review' | 'rejected'

/** Why a session reached its decision. */
export type DecisionReason =
  | 'AUTO_APPROVED'
  | 'LOW_DOCUMENT_QUALITY'
  | 'OCR_LOW_CONFIDENCE'
  | 'DOCUMENT_EXPIRED'
  | 'LIVENESS_FAILED'
  | 'LIVENESS_LOW_CONFIDENCE'
  | 'FACE_MATCH_FAILED'
  | 'FACE_MATCH_LOW_CONFIDENCE'
  | 'MULTIPLE_FACES_DETECTED'
  | 'MANUAL_APPROVAL'
  | 'MANUAL_REJECTION'
  | 'RETRY_REQUESTED'

/**
 * A verification session: the full lifecycle of one verification flow, owned by
 * a project (and tenant). Created from an integrator's backend, driven by the
 * widget, decided automatically and/or by a human reviewer.
 */
export interface VerificationSession extends Entity, ProjectScoped {
  /** Integrator's own reference for the end user being verified. */
  user_reference: string | null
  status: VerificationStatus
  auto_decision: VerificationDecision | null
  final_decision: VerificationDecision | null
  decision_reason: DecisionReason | null
  /** Aggregate risk score in [0, 1]; higher means riskier. */
  risk_score: number | null
  /** Hash of the short-lived client token issued to the widget. */
  client_token_hash: string | null
  expires_at: IsoDateTime
  completed_at: IsoDateTime | null
  reviewed_at: IsoDateTime | null
  reviewed_by: Id | null
  metadata: Metadata
}
