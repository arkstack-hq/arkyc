import type { DecisionReason, Metadata, VerificationDecision, VerificationStatus } from '@arkyc/types'

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



/** Payload delivered when the widget flow completes. */
export interface WidgetResult {
  status: string
  [key: string]: unknown
}

/** Options for {@link ArkycWidget.open}. */
export interface OpenWidgetOptions {
  /** The session's client token (from `arkyc.sessions.create`). */
  token: string
  /** Hosted widget origin (default `https://verify.arkyc.dev`). */
  widgetUrl?: string
  onComplete?: (result: WidgetResult) => void
  onError?: (error: unknown) => void
  onClose?: () => void
  /** Injectable for testing; defaults to the global `document`. */
  doc?: Document
  /** Injectable for testing; defaults to the global `window`. */
  win?: Window
}

/** A handle to the open widget. */
export interface WidgetHandle {
  close: () => void
}
