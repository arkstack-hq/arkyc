import type { Entity, Id, ProjectScoped } from './common'

/**
 * A gated project capability. Extended access generalizes what used to be the
 * single AI-processing grant: projects request one or more capabilities, a
 * platform admin approves each independently, and the app enforces the grant at
 * runtime. New gated (and, later, paywalled) features are added here plus a row
 * in {@link ACCESS_CAPABILITIES}, not a new subsystem.
 */
export type AccessCapability = 'ai' | 'pii'

/**
 * The lifecycle of a capability grant. `none` is synthetic (no row yet) and only
 * appears in API/UI responses; it is never persisted.
 */
export type AccessGrantStatus = 'none' | 'pending' | 'granted' | 'revoked'

/** Categories of personal data a project may request access to (PII capability). */
export type PiiCategory = 'identity' | 'address'

/** When a project needs the PII: before the session is decided, or only after. */
export type PiiTiming = 'before' | 'after'

/**
 * Capability-specific request detail. Only meaningful for `pii`: what data the
 * project needs, when, and their justification for being able to protect it.
 */
export interface AccessGrantDetails {
  categories?: PiiCategory[]
  timing?: PiiTiming
  justification?: string | null
}

/** A per-`(project, capability)` entitlement with a request/review lifecycle. */
export interface AccessGrant extends Entity, ProjectScoped {
  capability: AccessCapability
  status: AccessGrantStatus
  details: AccessGrantDetails | null
  note: string | null
  requested_by: Id | null
  requested_at: string | null
  reviewed_by: Id | null
  reviewed_at: string | null
}

/** Registry metadata for one capability. */
export interface AccessCapabilityMeta {
  key: AccessCapability
  label: string
  /** Whether projects can self-request it (vs admin-only grant). */
  requestable: boolean
  /** Whether a request must carry {@link AccessGrantDetails} (PII does). */
  requiresDetails: boolean
}

/**
 * The capability registry: the single source of truth for what can be gated.
 * Enforcement and UIs iterate this rather than hard-coding capability names.
 * (Room is left here for future `plan`/`billable` metadata behind a paywall.)
 */
export const ACCESS_CAPABILITIES: Record<AccessCapability, AccessCapabilityMeta> = {
  ai: { key: 'ai', label: 'AI document processing', requestable: true, requiresDetails: false },
  pii: { key: 'pii', label: 'Extracted PII access', requestable: true, requiresDetails: true },
}

/** All capability keys, in display order. */
export const ACCESS_CAPABILITY_KEYS: AccessCapability[] = ['ai', 'pii']
