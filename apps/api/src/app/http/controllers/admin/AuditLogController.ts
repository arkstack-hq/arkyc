import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import { AuditLog } from '@app/models/AuditLog'
import AdminAuditLogCollection from '@app/http/resources/AdminAuditLogCollection'

const param = (value: unknown): string | undefined =>
  (Array.isArray(value) ? value[0] : value) as string | undefined

/** Platform-wide audit log (across every tenant). Gated by `admin.audit.view`. */
export default class AuditLogController extends BaseController {
  /**
   * List audit entries across all tenants, newest first. Filter by `action`,
   * `entity_type`, or `tenant_id`.
   */
  async index({ req }: HttpContext) {
    let query = AuditLog.query()

    const action = param(req.query.action)
    const entityType = param(req.query.entity_type)
    const tenantId = param(req.query.tenant_id)
    if (action) query = query.where({ action })
    if (entityType) query = query.where({ entityType })
    if (tenantId) query = query.where({ tenantId })

    const logs = await query.latest('createdAt').paginate(perPage(req.query))

    return new AdminAuditLogCollection(logs).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }
}
