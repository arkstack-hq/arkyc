import type { Entity, Id, IsoDateTime, Metadata, ProjectScoped, TenantScoped } from './common'
import type { MembershipStatus } from './tenant'
import type { CaptureModel } from './settings'

/** Deployment environment for a project. */
export type ProjectEnvironment = 'production' | 'staging' | 'development'

/** Project lifecycle status. */
export type ProjectStatus = 'active' | 'paused' | 'archived'

/**
 * Per-project, configurable thresholds the decision engine compares scores
 * against. Defaults live in `@arkyc/core`; projects may override any subset.
 */
export interface VerificationThresholds {
  documentQualityThreshold: number
  ocrConfidenceThreshold: number
  livenessThreshold: number
  faceMatchThreshold: number
}

/** Visual branding applied to the widget for a project. */
export interface ProjectBranding {
  logo_url?: string | null
  primary_color?: string
  border_radius?: number
  theme?: 'light' | 'dark'
  /** Display name (company/product) shown in the widget header. */
  name?: string | null
  /**
   * Whether to show the project's name/logo in the widget header. Defaults to
   * shown; set `false` for an unbranded (white-label) header.
   */
  show_branding?: boolean
}

/**
 * Cross-device handoff: a desktop user continues an in-progress verification on
 * their phone by scanning a QR code.
 * The QR is shown first on desktop.
 */
export interface ProjectHandoffSettings {
  /** Whether desktop users are offered the QR handoff to their phone. */
  enabled?: boolean
  /**
   * Whether a desktop user may instead continue on the desktop device. When
   * `false`, a desktop user must scan to a phone (no "continue here"). Defaults true.
   */
  allow_desktop?: boolean
}

/** Project-level configuration. */
export interface ProjectSettings extends Metadata {
  thresholds?: Partial<VerificationThresholds>
  allowed_origins?: string[]
  /** Maximum verification attempts before a session is hard-failed. */
  max_retries?: number
  /** Overrides the global capture model for this project (Phase 17). */
  capture_model?: CaptureModel
  /** Cross-device session handoff (QR). Off unless the project opts in. */
  handoff?: ProjectHandoffSettings
}

/**
 * A specific application, environment, or product integration owned by a
 * tenant. Sessions, API keys, and webhooks are scoped to a project.
 */
export interface Project extends Entity, TenantScoped {
  name: string
  slug: string
  environment: ProjectEnvironment
  settings: ProjectSettings
  branding: ProjectBranding
  status: ProjectStatus
}

/** Links a user to a project with a role (narrower than tenant membership). */
export interface ProjectMember extends Entity, ProjectScoped {
  user_id: Id
  role_id: Id
  status: MembershipStatus
}

/**
 * A project API key. Only `key_prefix` is stored in clear; the secret is hashed
 * (`key_hash`) and shown to the integrator exactly once at creation.
 */
export interface ApiKey extends Entity, ProjectScoped {
  name: string
  key_prefix: string
  key_hash: string
  last_used_at: IsoDateTime | null
  expires_at: IsoDateTime | null
  revoked_at: IsoDateTime | null
}

/** An API key plus its one-time-visible secret, returned only at creation. */
export interface ApiKeyWithSecret {
  api_key: ApiKey
  /** The full secret key, e.g. `sk_live_…`. Never persisted in clear. */
  secret: string
}

/** Resolves the tenant + project + (optionally) acting user for a request. */
export interface ProjectContext {
  tenant_id: Id
  project_id: Id
  api_key_id?: Id
}
