import type { Id, IsoDateTime } from './common'
import type { DecisionReason } from './verification'

/** A fraud or compliance signal a detector can raise against a session. */
export type RiskSignalKey =
  | 'duplicate_document'
  | 'duplicate_identity'
  | 'duplicate_face'
  | 'document_tampering'
  | 'document_inconsistent'
  | 'sanctions_match'
  | 'pep_match'
  | 'adverse_media'
  | 'high_risk_network'
  | 'ip_country_mismatch'
  | 'velocity_exceeded'
  | 'underage'

/** Every signal key, in decision precedence order (most severe first). */
export const RISK_SIGNAL_KEYS: readonly RiskSignalKey[] = [
  'sanctions_match',
  'underage',
  'duplicate_document',
  'duplicate_face',
  'document_tampering',
  'document_inconsistent',
  'pep_match',
  'adverse_media',
  'duplicate_identity',
  'high_risk_network',
  'ip_country_mismatch',
  'velocity_exceeded',
]

/** What a signal does to the decision: nothing (`info`), manual review, or rejection. */
export type RiskSeverity = 'info' | 'review' | 'reject'

/** How a workflow treats a signal key. */
export type RiskSignalPolicy = 'ignore' | 'review' | 'reject'

/** Per-key policy overrides. Keys left out use {@link DEFAULT_RISK_SIGNAL_POLICY}. */
export type RiskPolicyConfig = Partial<Record<RiskSignalKey, RiskSignalPolicy>>

/** Signals route to review unless an organization opts a key into `ignore` or `reject`. */
export const DEFAULT_RISK_SIGNAL_POLICY: RiskSignalPolicy = 'review'

/** Signals that never reject, whatever the policy says: their evidence is too soft. */
export const REVIEW_ONLY_RISK_SIGNALS: readonly RiskSignalKey[] = ['duplicate_identity', 'ip_country_mismatch']

/** The decision reason each signal key reports when it decides a session. */
export const RISK_SIGNAL_REASONS: Record<RiskSignalKey, DecisionReason> = {
  duplicate_document: 'DUPLICATE_DOCUMENT',
  duplicate_identity: 'DUPLICATE_IDENTITY',
  duplicate_face: 'DUPLICATE_FACE',
  document_tampering: 'DOCUMENT_TAMPERING',
  document_inconsistent: 'DOCUMENT_TAMPERING',
  sanctions_match: 'SANCTIONS_MATCH',
  pep_match: 'PEP_MATCH',
  adverse_media: 'ADVERSE_MEDIA_MATCH',
  high_risk_network: 'HIGH_RISK_DEVICE',
  ip_country_mismatch: 'HIGH_RISK_DEVICE',
  velocity_exceeded: 'VELOCITY_EXCEEDED',
  underage: 'UNDERAGE',
}

/** A signal raised by a detector, before it is stored. */
export interface RiskSignal {
  key: RiskSignalKey
  severity: RiskSeverity
  /** How much the signal adds to the session's risk score, in [0, 1]. */
  score: number
  /** Advisory signals (model opinions) are capped at review. */
  advisory?: boolean
  /** Detector-specific facts that justify the signal. */
  evidence: Record<string, unknown>
}

/** A stored risk signal, as the dashboard API returns it. */
export interface SessionRiskSignal extends RiskSignal {
  id: Id
  session_id: Id
  /** Which detector raised it. */
  source: string
  cleared_at: IsoDateTime | null
  cleared_by: Id | null
  clear_reason: string | null
  created_at: IsoDateTime
}

/** The risk block of a webhook payload. */
export interface WebhookRiskCheck {
  score: number | null
  signals: Array<{
    key: RiskSignalKey
    severity: RiskSeverity
    cleared: boolean
  }>
}

/** A category of screening hit. */
export type ScreeningHitCategory = 'sanction' | 'pep' | 'adverse_media' | 'other'

/** One watchlist entity a screened identity matched. */
export interface ScreeningHit {
  /** Provider entity id, stable across re-screens. */
  entity_id: string
  name: string
  /** Match score in [0, 1]. */
  score: number
  category: ScreeningHitCategory
  /** Provider topic tags, e.g. `sanction`, `role.pep`. */
  topics: string[]
  /** Source lists the entity appears on. */
  datasets: string[]
  birth_dates: string[]
  countries: string[]
  /** A page describing the entity, when the provider has one. */
  url?: string
}

/** What a screening hit does to the session. */
export type ScreeningOnHit = 'review' | 'reject'

/** Configuration for the `screening` workflow stage. */
export interface ScreeningStepConfig {
  /** Minimum match score in [0, 1] that counts as a hit. */
  threshold: number
  /** What a sanctions hit does. PEP and adverse media hits follow the workflow's risk policy. */
  on_hit: ScreeningOnHit
  /** Re-screen the identity on a schedule after the session completes. */
  monitor: boolean
}

/** The default screening config applied when the stage is enabled without one. */
export const DEFAULT_SCREENING_CONFIG: ScreeningStepConfig = {
  threshold: 0.7,
  on_hit: 'review',
  monitor: false,
}

/** Project limits for repeat sessions from one network address. */
export interface VelocitySettings {
  /** Sessions from one IP, under different user references, before the signal fires. */
  max_sessions: number
  /** The look-back window in minutes. */
  window_minutes: number
}

export const DEFAULT_VELOCITY_SETTINGS: VelocitySettings = {
  max_sessions: 5,
  window_minutes: 60,
}

/** Organization-level opt-in for storing face embeddings. Off by default. */
export interface FaceEmbeddingSettings {
  enabled: boolean
  /** Days to keep an embedding before it is deleted. */
  retention_days: number
}

export const DEFAULT_FACE_EMBEDDING_SETTINGS: FaceEmbeddingSettings = {
  enabled: false,
  retention_days: 365,
}
