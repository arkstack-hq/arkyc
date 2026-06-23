import { Catalogue } from './catalogue'
import { AdminRoles, DefaultRoles } from './default-roles'
import type { AdminSyncStore, PermissionSyncStore } from './types'

/** Idempotent sync of the default permission catalogue and system roles. */
export class PermissionSync {
  /**
   * Upsert the full permission catalogue into the store. Idempotent: safe to run
   * on every boot/migration.
   *
   * @param store
   */
  static async permissions(store: PermissionSyncStore): Promise<void> {
    for (const def of Catalogue.ALL) {
      await store.upsertPermission(def)
    }
  }

  /**
   * Create (or update) the five built-in system roles for an organization and set each
   * role's permission grants to its default set. Idempotent per organization.
   *
   * @param organizationId
   * @param store
   */
  static async roles(organizationId: string, store: PermissionSyncStore): Promise<void> {
    for (const role of DefaultRoles.ALL) {
      const roleId = await store.upsertSystemRole(organizationId, role)
      await store.syncRolePermissions(roleId, role.permissions)
    }
  }

  /**
   * Upsert the platform-admin permission catalogue (`admin: true`). Idempotent;
   * safe to run on every boot/migration. Separate from {@link permissions} so
   * organization flows never touch the admin scope.
   *
   * @param store
   */
  static async adminPermissions(store: PermissionSyncStore): Promise<void> {
    for (const def of Catalogue.ADMIN) {
      await store.upsertPermission(def)
    }
  }

  /**
   * Create (or update) the built-in platform-admin roles and set each role's
   * permission grants to its default set. Idempotent. Run after
   * {@link adminPermissions} so the grants resolve.
   *
   * @param store
   */
  static async adminRoles(store: AdminSyncStore): Promise<void> {
    for (const role of AdminRoles.ALL) {
      const roleId = await store.upsertAdminRole(role)
      await store.syncRolePermissions(roleId, role.permissions)
    }
  }
}
