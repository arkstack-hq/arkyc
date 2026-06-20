import type { Entity, Id, IsoDateTime, Metadata, TenantScoped } from './common.js';

/** Membership lifecycle states for tenant/project members. */
export type MembershipStatus = 'active' | 'invited' | 'suspended';

/** Invitation lifecycle states. */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * An organization, business, or workspace using Arkyc. A tenant owns projects,
 * members, roles, API keys, sessions, webhooks, and audit logs.
 */
export interface Tenant extends Entity {
  name: string;
  slug: string;
  logo_url: string | null;
  settings: TenantSettings;
}

/** Tenant-level configuration (free-form, with known optional keys). */
export interface TenantSettings extends Metadata {
  /** Days to retain verification media before cleanup (Phase 15). */
  retention_days?: number;
}

/** Links a {@link User} to a {@link Tenant} with a role. */
export interface TenantMember extends Entity, TenantScoped {
  user_id: Id;
  role_id: Id;
  status: MembershipStatus;
  joined_at: IsoDateTime | null;
}

/** A pending invitation to join a tenant with a given role. */
export interface TenantInvitation extends Entity, TenantScoped {
  email: string;
  role_id: Id;
  /** Hash of the single-use invitation token; the raw token is emailed once. */
  token_hash: string;
  expires_at: IsoDateTime;
  accepted_at: IsoDateTime | null;
}
