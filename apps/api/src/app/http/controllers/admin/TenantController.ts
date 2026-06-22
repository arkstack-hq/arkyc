import { BaseController } from '@controllers/BaseController'
import TenantCollection from '@app/http/resources/TenantCollection'
import { toArray } from 'src/support/collection'
import { Tenant } from '@app/models/Tenant'

/** Platform-admin view over all tenants. Guarded by `canAdmin('admin.tenants.*')`. */
export default class TenantController extends BaseController {
  /** List every tenant on the platform (not scoped to the caller's memberships). */
  async index() {
    const tenants = toArray(await Tenant.all())

    return new TenantCollection(tenants).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }
}
