import { Command } from '@h3ravel/musket'
import { Logger } from '@arkstack/common'
import { Organization } from 'src/app/models/Organization'
import { PermissionSync } from '@arkyc/permissions'
import { permissionStore } from 'src/app/services/ArkormPermissionStore'
import { toArray } from 'src/support/collection'

/**
 * `ark permissions:sync` — reconcile the permission catalogue and system roles
 * with the code. Run it after changing the catalogue (added, removed, or
 * renamed permissions) so existing roles pick up the new grants, e.g. the
 * `admin.ai_processing.*` → `admin.extended_access.*` rename.
 *
 * Syncs the global + platform-admin catalogues, the platform-admin role grants,
 * and every organization's system-role grants. Idempotent. Note: grant sync is
 * additive (it never revokes), so renamed permissions leave harmless orphan rows
 * behind rather than removing access.
 */
export class PermissionsSyncCommand extends Command {
  signature = `permissions:sync
        {--skip-orgs : Only sync the global + admin catalogues and admin roles, not per-organization roles}
    `

  description = 'Reconcile the permission catalogue and system roles with the code'

  async handle() {
    await PermissionSync.permissions(permissionStore)
    await PermissionSync.adminPermissions(permissionStore)
    await PermissionSync.adminRoles(permissionStore)
    Logger.info('Synced the global + admin permission catalogues and admin roles.')

    if (this.option('skipOrgs') || this.option('skip-orgs')) {
      Logger.success('Permission sync complete (organizations skipped).', true)

      return
    }

    const organizations = toArray(await Organization.all())
    for (const organization of organizations) {
      await PermissionSync.roles(organization.id, permissionStore)
    }
    Logger.success(`Permission sync complete (${organizations.length} organization(s) reconciled).`, true)
  }
}
