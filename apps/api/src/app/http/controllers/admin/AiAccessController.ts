import { RequestException, perPage } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import { AiProcessingGrant } from '@app/models/AiProcessingGrant'
import { Project } from '@app/models/Project'
import AiAccessGrantResource from '@app/http/resources/AiAccessGrantResource'
import AiAccessGrantCollection from '@app/http/resources/AiAccessGrantCollection'
import CountResource from '@app/http/resources/CountResource'
import { platformAudit } from '@app/services/PlatformAuditLogger'

const param = (value: unknown): string | undefined => (Array.isArray(value) ? value[0] : value) as string | undefined

/**
 * Platform-admin management of project AI-processing access. Admins review
 * requests and grant/revoke access for any project (a request isn't required —
 * direct grants come from the admin organization view). Gated by
 * `admin.ai_processing.*`.
 */
export default class AiAccessController extends BaseController {
  /** Paginated access records across every organization, newest first; filter by `status`. */
  async index({ req }: HttpContext) {
    let query = AiProcessingGrant.query().with(['project', 'organization', 'requester', 'reviewer'])

    const status = param(req.query.status)
    if (status) query = query.where({ status })

    const grants = await query.latest('updatedAt').paginate(perPage(req.query))

    return new AiAccessGrantCollection(grants).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** Count of records in a status (default `pending`) — drives the nav badge. */
  async count({ req }: HttpContext) {
    const status = param(req.query.status) ?? 'pending'
    const count = await AiProcessingGrant.where({ status }).count()

    return new CountResource({ count }).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** Grant AI processing to a project — approves a request or grants directly. */
  async grant({ req }: HttpContext) {
    const grant = await this.upsert(req, 'granted')

    await platformAudit.recordForRequest(req, {
      action: 'ai_access.granted',
      entityType: 'ai_processing_grant',
      entityId: grant.id,
    })

    return new AiAccessGrantResource(grant).additional({
      status: 'success',
      message: 'AI processing access granted',
      code: 200,
    })
  }

  /** Revoke AI processing from a project. The record is kept (status `revoked`). */
  async revoke({ req }: HttpContext) {
    const grant = await this.upsert(req, 'revoked')

    await platformAudit.recordForRequest(req, {
      action: 'ai_access.revoked',
      entityType: 'ai_processing_grant',
      entityId: grant.id,
    })

    return new AiAccessGrantResource(grant).additional({
      status: 'success',
      message: 'AI processing access revoked',
      code: 200,
    })
  }

  /** Resolve the target project (from the body) and set its grant to `status`. */
  private async upsert(req: HttpContext['req'], status: 'granted' | 'revoked') {
    const data = await this.validate({ project_id: ['required', 'string'] })

    const project = await Project.where({ id: data.project_id }).first()
    RequestException.assertFound(project, 'Project not found', 404)

    const grant = await AiProcessingGrant.query().firstOrCreate(
      { projectId: project!.id },
      { organizationId: project!.organizationId, status },
    )
    grant.status = status
    grant.organizationId = project!.organizationId
    grant.reviewedBy = req.user?.id ?? null
    grant.reviewedAt = new Date()
    await grant.save()

    return grant
  }
}
