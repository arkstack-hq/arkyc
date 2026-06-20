import { BaseController } from '@controllers/BaseController'
import PermissionCollection from '@app/http/resources/PermissionCollection'
import { Permission } from '@app/models/Permission'

/** The permission catalogue. */
export default class PermissionController extends BaseController {
    /**
     * List the permission catalogue, ordered by group.
     *
     * @returns A PermissionCollection of all permissions.
     */
    async index () {
        const permissions = await Permission.query().orderBy({ group: 'asc' }).get()

        return new PermissionCollection(permissions).additional({ status: 'success', message: 'OK', code: 200 })
    }
}
