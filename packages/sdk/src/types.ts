import type {
  DecisionReason,
  Metadata,
  VerificationDecision,
  VerificationStatus,
} from '@arkyc/types'

/** A verification session as returned by the public API (snake_case JSON). */
export interface VerificationSession {
  id: string
  project_id: string
  user_reference: string | null
  status: VerificationStatus
  auto_decision: VerificationDecision | null
  final_decision: VerificationDecision | null
  decision_reason: DecisionReason | null
  risk_score: number | null
  assigned_to: string | null
  expires_at: string
  completed_at: string | null
  created_at: string
}

/** Parameters for opening a verification session. */
export interface CreateSessionParams {
  /** Your reference for the user being verified. */
  userReference?: string | null
  /** Arbitrary metadata stored with the session. */
  metadata?: Metadata | null
}

/** A freshly opened session plus its one-time client token for the widget. */
export interface CreatedSession {
  session: VerificationSession
  clientToken: string
}

/** Configuration for the server SDK client. */
export interface ArkycOptions {
  /** Project secret API key (`sk_…`). */
  secretKey: string
  /** API base URL (default `https://api.arkyc.dev`). */
  baseUrl?: string
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch
}
