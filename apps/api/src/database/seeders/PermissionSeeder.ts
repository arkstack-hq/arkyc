import { Seeder } from '@arkstack/database'
import { PermissionSync } from '@arkyc/permissions'
import { permissionStore } from 'src/app/services/ArkormPermissionStore'

/**
 * Sync the global permission catalogue and platform-admin scope. Idempotent:
 *   - tenant catalogue (`admin: false`)
 *   - platform-admin catalogue (`admin: true`)
 *   - platform-admin role(s) and their grants
 *
 * The first platform owner is granted separately via `ark admin:grant <email>`.
 */
export class PermissionSeeder extends Seeder {
  public async run(): Promise<void> {
    await PermissionSync.permissions(permissionStore)
    await PermissionSync.adminPermissions(permissionStore)
    await PermissionSync.adminRoles(permissionStore)
  }
}
