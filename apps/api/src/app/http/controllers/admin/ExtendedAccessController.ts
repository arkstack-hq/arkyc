import { type AccessCapability, ACCESS_CAPABILITY_KEYS } from '@arkyc/types'
import { RequestException, perPage } from '@arkstack/common'

import { AccessGrant } from '@app/models/AccessGrant'
import AccessGrantCollection from '@app/http/resources/AccessGrantCollection'
import AccessGrantResource from '@app/http/resources/AccessGrantResource'
import { BaseController } from '@controllers/BaseController'
import CountResource from '@app/http/resources/CountResource'
import { HttpContext } from 'clear-router/types/express'
import { Project } from '@app/models/Project'
import { platformAudit } from '@app/services/PlatformAuditLogger'

const param = (value: unknown): string | undefined => (Array.isArray(value) ? value[0] : value) as string | undefined

/**
 * Platform-admin management of extended access. Admins review per-capability
 * requests and grant or revoke each independently for any project (a request
 * isn't required — direct grants come from the admin organization view). Gated by
 * `admin.extended_access.*`.
 */
export default class ExtendedAccessController extends BaseController {
  /** Paginated grants across every organization, newest first; filter by `status`/`capability`. */
  async index({ req }: HttpContext) {
    let query = AccessGrant.query().with(['project', 'organization', 'requester', 'reviewer'])

    const status = param(req.query.status)
    if (status) query = query.where({ status })
    const capability = param(req.query.capability)
    if (capability) query = query.where({ capability })

    const grants = await query.latest('updatedAt').paginate(perPage(req.query))

    return new AccessGrantCollection(grants).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** Count of grants in a status (default `pending`) — drives the nav badge. */
  async count({ req }: HttpContext) {
    const status = param(req.query.status) ?? 'pending'
    const count = await AccessGrant.where({ status }).count()

    return new CountResource({ count }).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** A single project's grants across every capability, for the dedicated review page. */
  async project({ req }: HttpContext) {
    const projectId = param(req.params.projectId)
    const project = await Project.where({ id: projectId }).with('organization').first()
    RequestException.assertFound(project, 'Project not found', 404)

    const grants = await AccessGrant.where({ projectId: project!.id })
      .with(['project', 'organization', 'requester', 'reviewer'])
      .get()

    return new AccessGrantCollection(grants).additional({
      status: 'success',
      message: 'OK',
      code: 200,
      project: { id: project!.id, name: project!.name, organization_id: project!.organizationId },
    })
  }

  /** Grant a capability to a project — approves a request or grants directly. */
  async grant({ req }: HttpContext) {
    const grant = await this.upsert(req, 'granted')

    await platformAudit.recordForRequest(req, {
      action: 'extended_access.granted',
      entityType: 'access_grant',
      entityId: grant.id,
      metadata: { capability: grant.capability },
    })

    return new AccessGrantResource(grant).additional({ status: 'success', message: 'Access granted', code: 200 })
  }

  /** Revoke a capability from a project. The row is kept (status `revoked`). */
  async revoke({ req }: HttpContext) {
    const grant = await this.upsert(req, 'revoked')

    await platformAudit.recordForRequest(req, {
      action: 'extended_access.revoked',
      entityType: 'access_grant',
      entityId: grant.id,
      metadata: { capability: grant.capability },
    })

    return new AccessGrantResource(grant).additional({ status: 'success', message: 'Access revoked', code: 200 })
  }

  /** Resolve the target project + capability (from the body) and set that grant to `status`. */
  private async upsert(req: HttpContext['req'], status: 'granted' | 'revoked') {
    const data = await this.validate({
      project_id: ['required', 'string'],
      capability: ['required', `in:${ACCESS_CAPABILITY_KEYS.join(',')}`],
    })

    const project = await Project.where({ id: data.project_id }).first()
    RequestException.assertFound(project, 'Project not found', 404)

    const capability = data.capability as AccessCapability
    const grant = await AccessGrant.query().firstOrCreate(
      { projectId: project!.id, capability },
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
