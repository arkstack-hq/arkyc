import { BaseController } from '@controllers/BaseController'
import PermissionCollection from '@app/http/resources/PermissionCollection'
import { Permission } from '@app/models/Permission'

/** The permission catalogue. */
export default class PermissionController extends BaseController {
  /**
   * List the tenant permission catalogue, ordered by group. Platform-admin
   * permissions (`admin: true`) are excluded — they belong to the `/admin` scope.
   *
   * @returns A PermissionCollection of the tenant permissions.
   */
  async index() {
    const permissions = await Permission.query().where({ admin: false }).orderBy({ group: 'asc' }).get()

    return new PermissionCollection(permissions).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }
}
