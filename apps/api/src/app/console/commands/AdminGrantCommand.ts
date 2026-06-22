import { Command } from '@h3ravel/musket'
import { Logger } from '@arkstack/common'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { permissionStore } from 'src/app/services/ArkormPermissionStore'
import { User } from 'src/app/models/User'
import { Role } from 'src/app/models/Role'
import { AdminPermission } from 'src/app/models/AdminPermission'

/**
 * `ark admin:grant <email>` — designate the first (or another) platform owner.
 * Syncs the admin catalogue + roles, then grants the user the `platform-owner`
 * admin role via {@link AdminPermission} ("sync ownership"). Idempotent.
 */
export class AdminGrantCommand extends Command {
  signature = `admin:grant
        {email : The email of the user to grant platform-owner admin access}
    `

  description = 'Grant a user the platform-owner admin role (sync ownership)'

  async handle() {
    const email = String(this.argument('email')).trim()

    const user = await User.query().whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first()
    if (!user) {
      this.error(`No user found with email ${email}.`)

      return
    }

    // Ensure the admin catalogue + roles exist before granting.
    await PermissionSync.adminPermissions(permissionStore)
    await PermissionSync.adminRoles(permissionStore)

    const slug = AdminRoles.bySlug('platform-owner').slug
    const role = await Role.where({ slug, admin: true }).first()
    if (!role) {
      this.error('The platform-owner admin role was not found after sync.')

      return
    }

    const existing = await AdminPermission.where({ userId: user.id, roleId: role.id }).first()
    if (existing) {
      Logger.info(`${user.email} already holds the platform-owner role.`, true)

      return
    }

    await AdminPermission.create({ userId: user.id, roleId: role.id })
    Logger.success(`Granted platform-owner admin access to ${user.email}.`, true)
  }
}
