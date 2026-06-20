import { PERMISSION_CATALOGUE } from './catalogue';
import { DEFAULT_ROLES } from './default-roles';
import type { PermissionSyncStore } from './types';

/**
 * Upsert the full permission catalogue into the store. Idempotent: safe to run
 * on every boot/migration.
 */
export async function syncDefaultPermissions(store: PermissionSyncStore): Promise<void> {
  for (const def of PERMISSION_CATALOGUE) {
    await store.upsertPermission(def);
  }
}

/**
 * Create (or update) the five built-in system roles for a tenant and set each
 * role's permission grants to its default set. Idempotent per tenant.
 */
export async function syncDefaultRoles(
  tenantId: string,
  store: PermissionSyncStore,
): Promise<void> {
  for (const role of DEFAULT_ROLES) {
    const roleId = await store.upsertSystemRole(tenantId, role);
    await store.syncRolePermissions(roleId, role.permissions);
  }
}
