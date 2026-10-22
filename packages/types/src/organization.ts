import type { Entity, Id, IsoDateTime, Metadata, OrganizationScoped } from './common'
import type { BusinessVerificationStatus } from './business'
import type { FaceEmbeddingSettings } from './risk'

/** Membership lifecycle states for organization/project members. */
export type MembershipStatus = 'active' | 'invited' | 'suspended'

/** Invitation lifecycle states. */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

/**
 * An organization, business, or workspace using Arkyc. An organization owns projects,
 * members, roles, API keys, sessions, webhooks, and audit logs.
 */
export interface Organization extends Entity {
  name: string
  slug: string
  logo_url: string | null
  settings: OrganizationSettings
  /** Whether the organization has proven it may handle personal data in production. */
  verification_status: BusinessVerificationStatus
  verified_at: IsoDateTime | null
}

/** Organization-level configuration (free-form, with known optional keys). */
export interface OrganizationSettings extends Metadata {
  /** Days to retain verification media before cleanup (Phase 15). */
  retention_days?: number
  /** Store face embeddings to catch one face behind several identities. Off by default. */
  face_embeddings?: Partial<FaceEmbeddingSettings>
}

/** Links a {@link User} to a {@link Organization} with a role. */
export interface OrganizationMember extends Entity, OrganizationScoped {
  user_id: Id
  role_id: Id
  status: MembershipStatus
  joined_at: IsoDateTime | null
}

/** A pending invitation to join an organization with a given role. */
export interface OrganizationInvitation extends Entity, OrganizationScoped {
  email: string
  role_id: Id
  /** Hash of the single-use invitation token; the raw token is emailed once. */
  token_hash: string
  expires_at: IsoDateTime
  accepted_at: IsoDateTime | null
}
