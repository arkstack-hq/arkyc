import { RequestException, perPage } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import OrganizationCollection from '@app/http/resources/OrganizationCollection'
import AdminOrganizationDetailResource from '@app/http/resources/AdminOrganizationDetailResource'
import AdminProjectCollection from '@app/http/resources/AdminProjectCollection'
import { Organization } from '@app/models/Organization'
import { OrganizationMember } from '@app/models/OrganizationMember'
import { Project } from '@app/models/Project'
import { VerificationSession } from '@app/models/VerificationSession'
import { ApiKey } from '@app/models/ApiKey'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import { scopedSessionStats } from 'src/support/session-stats'
import { ProjectMember } from '@app/models/ProjectMember'
import { AccessGrant } from '@app/models/AccessGrant'
import AdminProjectDetailResource from '@app/http/resources/AdminProjectDetailResource'
import { toArray } from 'src/support/collection'
import { Thresholds } from '@arkyc/core'
import { ACCESS_CAPABILITY_KEYS } from '@arkyc/types'

const param = (value: unknown): string | undefined => (Array.isArray(value) ? value[0] : value) as string | undefined

/** Platform-admin view over all organizations. Guarded by `canAdmin('admin.organizations.*')`. */
export default class OrganizationController extends BaseController {
  /** Paginated list of every organization on the platform, newest first. */
  async index({ req }: HttpContext) {
    const organizations = await Organization.query().latest('createdAt').paginate(perPage(req.query))

    return new OrganizationCollection(organizations).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /**
   * Organization detail for admins: core fields and headline counts. Projects
   * are fetched separately and paginated (see {@link projects}).
   */
  async show({ req }: HttpContext) {
    const organization = await Organization.where({ id: param(req.params.organizationId) }).first()

    RequestException.assertFound(organization, 'Organization not found', 404)

    const organizationId = organization!.id
    const [projects, productionProjects, members, apiKeys, webhooks, sessions, stats, lastSession] = await Promise.all([
      Project.where({ organizationId }).count(),
      Project.where({ organizationId, environment: 'production' }).count(),
      OrganizationMember.where({ organizationId, status: 'active' }).count(),
      ApiKey.query().where({ organizationId }).whereNull('revokedAt').count(),
      WebhookEndpoint.where({ organizationId, status: 'active' }).count(),
      VerificationSession.where({ organizationId }).count(),
      scopedSessionStats('organization_id', organizationId),
      VerificationSession.where({ organizationId }).latest('createdAt').first(),
    ])

    return new AdminOrganizationDetailResource({
      id: organizationId,
      name: organization!.name,
      slug: organization!.slug,
      logoUrl: organization!.logoUrl,
      createdAt: organization!.createdAt,
      verificationStatus: organization!.verificationStatus,
      verifiedAt: organization!.verifiedAt,
      lastSessionAt: lastSession?.createdAt ?? null,
      counts: {
        projects,
        production_projects: productionProjects,
        members,
        api_keys: apiKeys,
        webhooks,
        sessions,
      },
      stats,
    }).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** Paginated projects for an organization, each with its extended-access status. */
  async projects({ req }: HttpContext) {
    const organizationId = param(req.params.organizationId)

    RequestException.assertFound(organizationId, 'Organization not found', 404)

    const projects = await Project.where({ organizationId })
      .with('accessGrants')
      .latest('createdAt')
      .paginate(perPage(req.query))

    return new AdminProjectCollection(projects).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** One project in depth: configuration, usage, session outcomes, access and recent sessions. */
  async project({ req }: HttpContext) {
    const project = await Project.where({
      id: param(req.params.projectId),
      organizationId: param(req.params.organizationId),
    })
      .with('organization')
      .firstOrFail()

    const [apiKeys, webhooks, members, stats, grants, recent] = await Promise.all([
      ApiKey.query().where({ projectId: project.id }).whereNull('revokedAt').count(),
      WebhookEndpoint.where({ projectId: project.id, status: 'active' }).count(),
      ProjectMember.where({ projectId: project.id }).count(),
      scopedSessionStats('project_id', project.id),
      AccessGrant.where({ projectId: project.id }).get(),
      VerificationSession.where({ projectId: project.id }).latest('createdAt').limit(10).get(),
    ])
    const organization = project.getAttribute('organization') as Organization

    return new AdminProjectDetailResource({
      id: project.id,
      name: project.name,
      slug: project.slug,
      environment: project.environment,
      status: project.status,
      createdAt: project.createdAt,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        verification_status: organization.verificationStatus,
      },
      thresholds: Thresholds.resolve(project.settings?.thresholds),
      counts: { api_keys: apiKeys, webhooks, members },
      stats,
      extendedAccess: Object.fromEntries(
        ACCESS_CAPABILITY_KEYS.map((capability) => {
          const grant = toArray(grants).find((row) => row.capability === capability)

          return [capability, { status: grant?.status ?? 'none', reviewed_at: grant?.reviewedAt ?? null }]
        }),
      ),
      recentSessions: toArray(recent).map((session) => ({
        id: session.id,
        user_reference: session.userReference,
        status: session.status,
        decision_reason: session.decisionReason,
        risk_score: session.riskScore,
        created_at: session.createdAt,
      })),
    }).additional({ status: 'success', message: 'OK', code: 200 })
  }
}
