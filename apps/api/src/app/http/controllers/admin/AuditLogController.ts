import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import { PlatformAuditLog } from '@app/models/PlatformAuditLog'
import AdminAuditLogCollection from '@app/http/resources/AdminAuditLogCollection'

const param = (value: unknown): string | undefined => (Array.isArray(value) ? value[0] : value) as string | undefined

/** Platform-admin audit log. Gated by `admin.audit.view`. */
export default class AuditLogController extends BaseController {
  /**
   * List platform-admin audit entries, newest first, with the acting user
   * eager-loaded. Filter by `action` or `entity_type`.
   */
  async index({ req }: HttpContext) {
    let query = PlatformAuditLog.query().with('actor')

    const action = param(req.query.action)
    const entityType = param(req.query.entity_type)
    if (action) query = query.where({ action })
    if (entityType) query = query.where({ entityType })

    const logs = await query.latest('createdAt').paginate(perPage(req.query))

    return new AdminAuditLogCollection(logs).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }
}
