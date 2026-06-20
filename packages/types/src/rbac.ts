import type { Entity, Id, TenantScoped } from './common.js';

/**
 * The full catalogue of permission strings recognised by Arkyc.
 *
 * Permissions are grouped by domain (`<group>.<action>`). Effective access for
 * a user is the union of their role permissions and any directly-assigned
 * permissions (see `@arkyc/permissions`).
 */
export type PermissionKey =
  | 'tenants.view'
  | 'tenants.update'
  | 'tenants.delete'
  | 'members.view'
  | 'members.invite'
  | 'members.update'
  | 'members.remove'
  | 'projects.view'
  | 'projects.create'
  | 'projects.update'
  | 'projects.delete'
  | 'api_keys.view'
  | 'api_keys.create'
  | 'api_keys.revoke'
  | 'webhooks.view'
  | 'webhooks.create'
  | 'webhooks.update'
  | 'webhooks.delete'
  | 'webhooks.test'
  | 'sessions.view'
  | 'sessions.create'
  | 'sessions.cancel'
  | 'sessions.retry'
  | 'sessions.export'
  | 'reviews.view'
  | 'reviews.assign'
  | 'reviews.approve'
  | 'reviews.reject'
  | 'reviews.request_retry'
  | 'reviews.note'
  | 'audit_logs.view'
  | 'settings.view'
  | 'settings.update'
  | 'billing.view'
  | 'billing.update';

/** The domain groups permissions are organised under. */
export type PermissionGroup =
  | 'tenants'
  | 'members'
  | 'projects'
  | 'api_keys'
  | 'webhooks'
  | 'sessions'
  | 'reviews'
  | 'audit_logs'
  | 'settings'
  | 'billing';

/** The built-in system roles seeded for every tenant. */
export type SystemRoleSlug = 'owner' | 'admin' | 'reviewer' | 'developer' | 'readonly';

/** A permission definition row. Permissions are global (not tenant-scoped). */
export interface Permission extends Entity {
  /** The permission string, e.g. `sessions.view`. */
  name: PermissionKey;
  description: string | null;
  group: PermissionGroup;
}

/**
 * A role within a tenant. System roles (`is_system`) are seeded and cannot be
 * deleted; tenants may also define custom roles.
 */
export interface Role extends Entity, TenantScoped {
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
}

/** Join row granting a {@link Permission} to a {@link Role}. */
export interface RolePermission extends Entity {
  role_id: Id;
  permission_id: Id;
}

/**
 * A permission assigned directly to a user, on top of their role permissions.
 * `project_id` is null for tenant-level grants, set for project-level grants.
 */
export interface UserPermission extends Entity, TenantScoped {
  project_id: Id | null;
  user_id: Id;
  permission_id: Id;
}
