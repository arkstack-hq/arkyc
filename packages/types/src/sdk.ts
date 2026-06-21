import type { Metadata } from './common'
import type { VerificationDecision, VerificationStatus } from './verification'

/** Options for constructing the server SDK client (`new Arkyc(...)`). */
export interface SdkOptions {
  /** Project secret key, e.g. `sk_live_…`. */
  secretKey: string
  /** API base URL; defaults to the hosted Arkyc API. */
  baseUrl?: string
  /** Request timeout in milliseconds. */
  timeoutMs?: number
}

/** Parameters for creating a verification session from a backend. */
export interface CreateSessionParams {
  userReference?: string
  metadata?: Metadata
  /** Optional override for how long the session/client token stays valid. */
  expiresInSeconds?: number
}

/** The session representation returned by the SDK/public API. */
export interface SessionResource {
  id: string
  status: VerificationStatus
  user_reference: string | null
  decision: VerificationDecision | null
  /** Short-lived client token for launching the widget (create response only). */
  client_token?: string
  expires_at: string
  created_at: string
}
