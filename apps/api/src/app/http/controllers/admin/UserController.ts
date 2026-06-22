import { RequestException, perPage } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { BaseController } from '@controllers/BaseController'
import AdminUserCollection from '@app/http/resources/AdminUserCollection'
import EmptyResource from '@app/http/resources/EmptyResource'
import { permissionStore } from '@app/services/ArkormPermissionStore'
import { platformAudit } from '@app/services/PlatformAuditLogger'
import { User } from '@app/models/User'
import { Role } from '@app/models/Role'
import { AdminPermission } from '@app/models/AdminPermission'

const param = (value: unknown): string | undefined => (Array.isArray(value) ? value[0] : value) as string | undefined

/** Platform users management. Gated by `canAdmin('admin.users.*')`. */
export default class UserController extends BaseController {
  /**
   * Paginated list of every platform user, newest first, with an `is_admin`
   * flag. Filter by `search` (name/email).
   */
  async index({ req }: HttpContext) {
    let query = User.query().with('adminPermissions')

    const search = param(req.query.search)
    if (search) {
      query = query.whereRaw(
        'LOWER("firstname") LIKE ? OR LOWER("lastname") LIKE ? OR LOWER("email") LIKE ?',
        Array(3).fill(`%${search.toLowerCase()}%`),
      )
    }

    const users = await query.latest('createdAt').paginate(perPage(req.query))

    return new AdminUserCollection(users).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Grant a user the platform-owner admin role ("sync ownership"). Idempotent. */
  async grantAdmin({ req }: HttpContext) {
    const user = await User.where({ id: param(req.params.userId) }).first()
    RequestException.assertFound(user, 'User not found', 404)

    await PermissionSync.adminPermissions(permissionStore)
    await PermissionSync.adminRoles(permissionStore)

    const role = await Role.where({
      slug: AdminRoles.bySlug('platform-owner').slug,
      admin: true,
    }).first()
    RequestException.assertFound(role, 'platform-owner admin role missing', 500)

    await AdminPermission.query().firstOrCreate({ userId: user.id, roleId: role.id }, { permissionId: null })

    await platformAudit.recordForRequest(req, {
      action: 'platform.admin_granted',
      entityType: 'user',
      entityId: user.id,
    })

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Admin access granted',
      code: 200,
    })
  }

  /** Revoke every platform-admin grant from a user. */
  async revokeAdmin({ req }: HttpContext) {
    const userId = param(req.params.userId)
    RequestException.assertFound(userId, 'User not found', 404)

    await AdminPermission.where({ userId }).delete()

    await platformAudit.recordForRequest(req, {
      action: 'platform.admin_revoked',
      entityType: 'user',
      entityId: userId,
    })

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Admin access revoked',
      code: 200,
    })
  }
}
