import type { Entity, Id, OrganizationScoped } from './common'

/**
 * The full catalogue of permission strings recognised by Arkyc.
 *
 * Permissions are grouped by domain (`<group>.<action>`). Effective access for
 * a user is the union of their role permissions and any directly-assigned
 * permissions (see `@arkyc/permissions`).
 */
export type PermissionKey =
  | 'organizations.view'
  | 'organizations.update'
  | 'organizations.delete'
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
  | 'workflows.view'
  | 'workflows.create'
  | 'workflows.update'
  | 'workflows.delete'
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
  | 'billing.update'

/** The domain groups permissions are organised under. */
export type PermissionGroup =
  | 'organizations'
  | 'members'
  | 'projects'
  | 'api_keys'
  | 'webhooks'
  | 'workflows'
  | 'sessions'
  | 'reviews'
  | 'audit_logs'
  | 'settings'
  | 'billing'

/** The built-in system roles seeded for every organization. */
export type SystemRoleSlug = 'owner' | 'admin' | 'reviewer' | 'developer' | 'readonly'

/**
 * Platform-scope permission strings, distinct from organization {@link PermissionKey}.
 * These gate the super-admin surface above organizations and are only ever granted
 * through {@link AdminPermission} (never an organization role). Rows carry `admin: true`.
 */
export type AdminPermissionKey =
  | 'admin.organizations.view'
  | 'admin.organizations.manage'
  | 'admin.users.view'
  | 'admin.users.manage'
  | 'admin.settings.view'
  | 'admin.settings.update'
  | 'admin.audit.view'
  | 'admin.billing.view'
  | 'admin.billing.update'
  | 'admin.extended_access.view'
  | 'admin.extended_access.manage'

/** The domain groups platform-admin permissions are organised under. */
export type AdminPermissionGroup =
  | 'admin.organizations'
  | 'admin.users'
  | 'admin.settings'
  | 'admin.audit'
  | 'admin.billing'
  | 'admin.extended_access'

/** Any permission string, organization- or platform-scope. */
export type AnyPermissionKey = PermissionKey | AdminPermissionKey

/** Any permission group, organization- or platform-scope. */
export type AnyPermissionGroup = PermissionGroup | AdminPermissionGroup

/** The built-in platform-admin role slug. */
export type AdminRoleSlug = 'platform-owner'

/** A permission definition row. Permissions are global (not organization-scoped). */
export interface Permission extends Entity {
  /** The permission string, e.g. `sessions.view` or `admin.settings.view`. */
  name: AnyPermissionKey
  description: string | null
  group: AnyPermissionGroup
  /** Platform-scope permission (gates the super-admin surface). */
  admin: boolean
}

/**
 * A role within an organization. System roles (`is_system`) are seeded and cannot be
 * deleted; organizations may also define custom roles.
 */
export interface Role extends Entity {
  /** Null for platform-admin roles (`admin: true`); set for organization roles. */
  organization_id: Id | null
  name: string
  slug: string
  description: string | null
  is_system: boolean
  /** Platform-admin role (not organization-scoped). */
  admin: boolean
}

/** Join row granting a {@link Permission} to a {@link Role}. */
export interface RolePermission extends Entity {
  role_id: Id
  permission_id: Id
}

/**
 * A permission assigned directly to a user, on top of their role permissions.
 * `project_id` is null for organization-level grants, set for project-level grants.
 */
export interface UserPermission extends Entity, OrganizationScoped {
  project_id: Id | null
  user_id: Id
  permission_id: Id
}

/**
 * A platform-admin grant to a user. Mirrors {@link UserPermission} but without
 * organization/project scope. A row is EITHER a role grant (`role_id` set) or a direct
 * permission grant (`permission_id` set). Effective admin access is the union of
 * both, resolved by `@arkyc/permissions`.
 */
export interface AdminPermission extends Entity {
  user_id: Id
  permission_id: Id | null
  role_id: Id | null
}
