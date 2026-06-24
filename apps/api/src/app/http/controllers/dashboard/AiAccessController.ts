import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import { AiProcessingGrant } from '@app/models/AiProcessingGrant'
import { Project } from '@app/models/Project'
import AiAccessGrantResource from '@app/http/resources/AiAccessGrantResource'
import { audit } from '@app/services/AuditLogger'

/**
 * Project-owner view of AI document-processing access. Owners see the current
 * status and request access; platform admins grant/revoke it (see the admin
 * surface). Gated by `projects.view` (read) and `projects.update` (request).
 */
export default class AiAccessController extends BaseController {
  /** The project's AI-access status — synthetic `none` when never requested. */
  async show({ req }: HttpContext) {
    const project = await this.project(req)
    const grant = await AiProcessingGrant.where({ projectId: project.id }).first()

    const resource =
      grant ??
      ({
        id: null,
        organizationId: project.organizationId,
        projectId: project.id,
        status: 'none',
        note: null,
        requestedBy: null,
        requestedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: null,
        updatedAt: null,
      } as const)

    return new AiAccessGrantResource(resource).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** Request AI processing for the project. Idempotent; a no-op once granted. */
  async request({ req }: HttpContext) {
    const project = await this.project(req)
    const data = await this.validate({ note: ['nullable', 'string', 'max:500'] })

    const grant = await AiProcessingGrant.query().firstOrCreate(
      { projectId: project.id },
      { organizationId: project.organizationId, status: 'pending' },
    )

    if (grant.status !== 'granted') {
      grant.status = 'pending'
      grant.organizationId = project.organizationId
      grant.requestedBy = req.user?.id ?? null
      grant.requestedAt = new Date()
      if (data.note != null) grant.note = data.note
      await grant.save()

      await audit.recordForRequest(req, {
        projectId: project.id,
        action: 'ai_access.requested',
        entityType: 'ai_processing_grant',
        entityId: grant.id,
      })
    }

    return new AiAccessGrantResource(grant).additional({
      status: 'success',
      message: 'AI processing access requested',
      code: 200,
    })
  }

  /** Resolve the route's project, scoped to the active organization (404 otherwise). */
  private project(req: HttpContext['req']) {
    return Project.where({ id: req.params.projectId, organizationId: req.organization!.id }).firstOrFail()
  }
}
