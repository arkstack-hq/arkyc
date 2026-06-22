import { RequestException } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { Permissions } from '@arkyc/permissions'
import { BaseController } from '@controllers/BaseController'
import AdminMeResource from '@app/http/resources/AdminMeResource'
import { permissionStore } from '@app/services/ArkormPermissionStore'

/** Platform-admin meta endpoints. */
export default class AdminController extends BaseController {
  /**
   * The caller's effective platform-admin permissions. Guarded by `auth` only —
   * any authenticated user may ask their own standing (empty for non-admins).
   */
  async me({ req }: HttpContext) {
    const user = req.user
    RequestException.assertFound(user, 'Unauthenticated', 401)

    const permissions = await Permissions.resolveAdmin({ userId: user.id }, permissionStore)

    return new AdminMeResource({ permissions, isAdmin: permissions.length > 0 }).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }
}
