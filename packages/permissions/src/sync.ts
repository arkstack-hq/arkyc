import { Catalogue } from './catalogue';
import { DefaultRoles } from './default-roles';
import type { PermissionSyncStore } from './types';

/** Idempotent sync of the default permission catalogue and system roles. */
export class PermissionSync {
  /**
   * Upsert the full permission catalogue into the store. Idempotent: safe to run
   * on every boot/migration.
   */
  static async permissions(store: PermissionSyncStore): Promise<void> {
    for (const def of Catalogue.ALL) {
      await store.upsertPermission(def);
    }
  }

  /**
   * Create (or update) the five built-in system roles for a tenant and set each
   * role's permission grants to its default set. Idempotent per tenant.
   */
  static async roles(
    tenantId: string,
    store: PermissionSyncStore,
  ): Promise<void> {
    for (const role of DefaultRoles.ALL) {
      const roleId = await store.upsertSystemRole(tenantId, role);
      await store.syncRolePermissions(roleId, role.permissions);
    }
  }
}
