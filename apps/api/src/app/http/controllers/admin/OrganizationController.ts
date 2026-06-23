import { BaseController } from '@controllers/BaseController'
import OrganizationCollection from '@app/http/resources/OrganizationCollection'
import { toArray } from 'src/support/collection'
import { Organization } from '@app/models/Organization'

/** Platform-admin view over all organizations. Guarded by `canAdmin('admin.organizations.*')`. */
export default class OrganizationController extends BaseController {
  /** List every organization on the platform (not scoped to the caller's memberships). */
  async index() {
    const organizations = toArray(await Organization.all())

    return new OrganizationCollection(organizations).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }
}
