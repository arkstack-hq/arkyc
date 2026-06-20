import type { PermissionKey } from '@arkyc/types';
import type { PermissionResolutionContext, PermissionResolverStore } from './types';

/** Deduplicate permission keys, preserving first-seen order. */
export function dedupePermissions(permissions: Iterable<PermissionKey>): PermissionKey[] {
  return [...new Set(permissions)];
}

/**
 * Resolve the effective permission set for a user within a tenant (and,
 * optionally, a project).
 *
 * The result is the deduplicated union of:
 *   - permissions from the tenant role
 *   - permissions from the project role (only when `projectId` is set)
 *   - direct tenant-level user permissions
 *   - direct project-level user permissions
 *
 * i.e. `effective_permissions = role_permissions + direct_user_permissions`.
 */
export async function resolvePermissions(
  ctx: PermissionResolutionContext,
  store: PermissionResolverStore,
): Promise<PermissionKey[]> {
  const [tenantRole, projectRole, direct] = await Promise.all([
    store.tenantRolePermissions(ctx),
    ctx.projectId ? store.projectRolePermissions(ctx) : Promise.resolve([] as PermissionKey[]),
    store.directPermissions(ctx),
  ]);

  return dedupePermissions([...tenantRole, ...projectRole, ...direct]);
}
