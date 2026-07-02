import {
  ACCESS_CAPABILITIES,
  ACCESS_CAPABILITY_KEYS,
  type AccessCapability,
  type AccessGrantDetails,
} from '@arkyc/types'

import { AccessGrant } from '@app/models/AccessGrant'
import { BaseController } from '@controllers/BaseController'
import { HttpContext } from 'clear-router/types/express'
import { Project } from '@app/models/Project'
import AccessGrantCollection from '@app/http/resources/AccessGrantCollection'
import { ValidationException } from 'kanun'
import { audit } from '@app/services/AuditLogger'
import { toArray } from 'src/support/collection'

/** The requestable capability keys, derived from the registry. */
const REQUESTABLE = ACCESS_CAPABILITY_KEYS.filter((key) => ACCESS_CAPABILITIES[key].requestable)

/**
 * Project-owner view of extended access. Owners see the per-capability status and
 * request one or more gated capabilities (`ai`, `pii`); platform admins grant or
 * revoke each independently (see the admin surface). Gated by `projects.view`
 * (read) and `projects.update` (request).
 */
export default class ExtendedAccessController extends BaseController {
  /** The project's grant for every capability, synthesizing `none` when never requested. */
  async show({ req }: HttpContext) {
    const project = await this.project(req)
    const grants = toArray(await AccessGrant.where({ projectId: project.id }).get())
    const byCapability = new Map(grants.map((grant) => [grant.capability, grant]))

    const rows = ACCESS_CAPABILITY_KEYS.map(
      (capability) => byCapability.get(capability) ?? this.synthetic(project, capability),
    )

    return new AccessGrantCollection(rows).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /**
   * Request one or more capabilities for the project. Each requested capability
   * becomes a `pending` grant (a no-op once already `granted`). PII carries its
   * required categories, timing, and justification.
   */
  async request({ req }: HttpContext) {
    const project = await this.project(req)
    const data = await this.validate({
      capabilities: ['required', 'array', 'min:1'],
      'capabilities.*': [`in:${REQUESTABLE.join(',')}`],
      'pii.categories': ['nullable', 'array'],
      'pii.categories.*': ['in:identity,address'],
      'pii.timing': ['nullable', 'in:before,after'],
      'pii.justification': ['nullable', 'string', 'max:2000'],
    })

    const capabilities = [...new Set(data.capabilities as AccessCapability[])]
    // `validate` types nested rule keys as dotted strings, so read the PII object
    // from the raw body (it was already validated by the rules above).
    const pii = (this.body?.pii ?? {}) as { categories?: string[]; timing?: string; justification?: string }

    if (capabilities.includes('pii')) {
      if (!pii.categories?.length || !pii.timing || !pii.justification?.trim()) {
        throw ValidationException.withMessages({
          'pii.justification': ['PII access needs the data categories, timing, and a justification.'],
        })
      }
    }

    for (const capability of capabilities) {
      const grant = await AccessGrant.query().firstOrCreate(
        { projectId: project.id, capability },
        { organizationId: project.organizationId, status: 'pending' },
      )
      if (grant.status === 'granted') continue

      grant.status = 'pending'
      grant.organizationId = project.organizationId
      grant.requestedBy = req.user?.id ?? null
      grant.requestedAt = new Date()
      if (capability === 'pii') grant.details = this.piiDetails(pii)
      await grant.save()

      await audit.recordForRequest(req, {
        projectId: project.id,
        action: 'extended_access.requested',
        entityType: 'access_grant',
        entityId: grant.id,
        metadata: { capability },
      })
    }

    return this.show({ req } as HttpContext)
  }

  /** A synthetic `none` grant for a capability the project has never requested. */
  private synthetic(project: Project, capability: AccessCapability) {
    return {
      id: null,
      organizationId: project.organizationId,
      projectId: project.id,
      capability,
      status: 'none',
      details: null,
      note: null,
      requestedBy: null,
      requestedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: null,
      updatedAt: null,
    } as const
  }

  /** Normalize the PII request detail from the validated body. */
  private piiDetails(pii: unknown): AccessGrantDetails {
    const p = (pii ?? {}) as { categories?: string[]; timing?: string; justification?: string }

    return {
      categories: (p.categories ?? []) as AccessGrantDetails['categories'],
      timing: p.timing as AccessGrantDetails['timing'],
      justification: p.justification?.trim() ?? null,
    }
  }

  /** Resolve the route's project, scoped to the active organization (404 otherwise). */
  private project(req: HttpContext['req']) {
    return Project.where({ id: req.params.projectId, organizationId: req.organization!.id }).firstOrFail()
  }
}
