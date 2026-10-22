import type { Entity, Id, IsoDateTime, Metadata, OrganizationScoped, ProjectScoped } from './common'

import type { CaptureModel } from './settings'
import type { MembershipStatus } from './organization'
import type { VelocitySettings } from './risk'

/** Deployment environment for a project. */
export type ProjectEnvironment = 'production' | 'staging' | 'development'

/** Project lifecycle status. */
export type ProjectStatus = 'active' | 'paused' | 'archived'

/**
 * Per-project, configurable thresholds the decision engine compares scores
 * against. Projects may override any subset of {@link DEFAULT_VERIFICATION_THRESHOLDS}.
 */
export interface VerificationThresholds {
  documentQualityThreshold: number
  ocrConfidenceThreshold: number
  livenessThreshold: number
  /**
   * Liveness score below which a failed check is declined outright. A failed
   * check scoring from here up is borderline (a laptop webcam's noise can look
   * like a screen to the anti-spoofing model) and goes to manual review instead.
   * At or below `livenessThreshold`. A failed challenge sequence scores 0, so it
   * is always declined.
   */
  livenessRejectThreshold: number
  faceMatchThreshold: number
  /**
   * Face-match similarity below which a session is rejected outright. Unset (the
   * default), the face-match driver's own verdict decides, and a failed match is
   * rejected. Set it below `faceMatchThreshold` so weak-but-plausible matches go to
   * manual review instead: rejected below this, reviewed from here up to
   * `faceMatchThreshold`, auto-approved above it. Document portraits often score
   * lower against a live selfie than two photos do, so this suits ID-to-selfie.
   */
  faceMatchRejectThreshold?: number | null
  /**
   * Minimum address-verification confidence before flagging for review.
   */
  addressThreshold: number
}

/** Platform default verification thresholds. */
export const DEFAULT_VERIFICATION_THRESHOLDS: VerificationThresholds = {
  documentQualityThreshold: 0.75,
  ocrConfidenceThreshold: 0.8,
  livenessThreshold: 0.85,
  livenessRejectThreshold: 0.2,
  faceMatchThreshold: 0.75,
  addressThreshold: 0.6,
}

/** Arkyc's brand color: a project's primary color until it sets its own. */
export const DEFAULT_PRIMARY_COLOR = 'rgb(184, 134, 11)'

/** Visual branding applied to the widget for a project. */
export interface ProjectBranding {
  logo_url?: string | null
  /**
   * Storage object key of an uploaded logo. Server-side only: the API resolves
   * it to a (signed, when the disk is private) `logo_url` in every response.
   */
  logo_key?: string | null
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
  /** Repeat-session limits per network address (`VELOCITY_EXCEEDED`). */
  velocity?: Partial<VelocitySettings>
}

/**
 * A specific application, environment, or product integration owned by a
 * organization. Sessions, API keys, and webhooks are scoped to a project.
 */
export interface Project extends Entity, OrganizationScoped {
  name: string
  slug: string
  environment: ProjectEnvironment
  settings: ProjectSettings
  branding: ProjectBranding
  status: ProjectStatus
  has_ai_grant?: boolean
  /** Set while the project is queued for deletion. */
  deletion_requested_at?: IsoDateTime | null
}

/** Links a user to a project with a role (narrower tha organization membership). */
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

/** Resolves the organization + project + (optionally) acting user for a request. */
export interface ProjectContext {
  organization_id: Id
  project_id: Id
  api_key_id?: Id
}
