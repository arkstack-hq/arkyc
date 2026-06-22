import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import { AuditLog } from '@app/models/AuditLog'
import AuditLogCollection from '@app/http/resources/AuditLogCollection'

const param = (value: unknown): string | undefined => (Array.isArray(value) ? value[0] : value) as string | undefined

/** Tenant audit-log read API (Phase 9). Gated by `audit_logs.view`. */
export default class AuditLogController extends BaseController {
  /**
   * List the tenant's audit entries, newest first. Filter by `action` or
   * `entity_type` query params.
   */
  async index({ req }: HttpContext) {
    let query = AuditLog.where({ tenantId: req.tenant!.id })
    const action = param(req.query.action)
    const entityType = param(req.query.entity_type)
    if (action) query = query.where({ action })
    if (entityType) query = query.where({ entityType })

    const logs = await query.latest('createdAt').paginate(perPage(req.query))

    return new AuditLogCollection(logs).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }
}
