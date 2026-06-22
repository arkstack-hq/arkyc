import type { AdminPermissionKey, AnyPermissionKey, PermissionKey } from '@arkyc/types'
import type { PermissionDefinition } from './catalogue'
import type { AdminRoleDefinition, DefaultRoleDefinition } from './default-roles'

/** Identifies whose effective permissions to resolve, and in what scope. */
export interface PermissionResolutionContext {
  userId: string
  tenantId: string
  /** When set, project-level role and direct permissions are also included. */
  projectId?: string | null
}

/**
 * Read port the resolver depends on. Implemented by the API against Arkormˣ;
 * faked in tests. Keeping it abstract lets `@arkyc/permissions` stay free of any
 * database dependency so it is reusable by the api, dashboard, and sdk.
 */
export interface PermissionResolverStore {
  /** Permission keys granted via the user's tenant-level role. */
  tenantRolePermissions(ctx: PermissionResolutionContext): Promise<readonly PermissionKey[]>
  /** Permission keys granted via the user's project-level role (if `projectId`). */
  projectRolePermissions(ctx: PermissionResolutionContext): Promise<readonly PermissionKey[]>
  /**
   * Direct permission keys assigned to the user: tenant-level grants
   * (`project_id` null) plus project-level grants matching `projectId`.
   */
  directPermissions(ctx: PermissionResolutionContext): Promise<readonly PermissionKey[]>
}

/** Write port used by the sync helpers to seed permissions and system roles. */
export interface PermissionSyncStore {
  /** Insert or update a permission by its `name`. */
  upsertPermission(def: PermissionDefinition): Promise<void>
  /** Insert or update a tenant's system role by slug; returns its id. */
  upsertSystemRole(tenantId: string, role: DefaultRoleDefinition): Promise<string>
  /** Replace a role's permission grants with exactly `permissions`. */
  syncRolePermissions(roleId: string, permissions: readonly AnyPermissionKey[]): Promise<void>
}

/** Identifies whose effective platform-admin permissions to resolve. */
export interface AdminResolutionContext {
  userId: string
}

/**
 * Read port for platform-admin resolution. Distinct from the tenant
 * {@link PermissionResolverStore}: a tenant role must never grant admin access.
 */
export interface AdminResolverStore {
  /** Admin permission keys granted via the user's platform-admin role(s). */
  adminRolePermissions(ctx: AdminResolutionContext): Promise<readonly AdminPermissionKey[]>
  /** Admin permission keys granted directly to the user. */
  adminDirectPermissions(ctx: AdminResolutionContext): Promise<readonly AdminPermissionKey[]>
}

/** Write port used by the admin sync helpers to seed the admin catalogue/roles. */
export interface AdminSyncStore extends PermissionSyncStore {
  /** Insert or update a platform-admin role by slug (no tenant); returns its id. */
  upsertAdminRole(role: AdminRoleDefinition): Promise<string>
}

/** Thrown by `authorize`/`ensurePermission` when a required permission is absent. */
export class PermissionDeniedError extends Error {
  constructor(public readonly permission: string) {
    super(`Permission denied: ${permission}`)
    this.name = 'PermissionDeniedError'
  }
}
