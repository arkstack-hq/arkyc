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

    const [projects, members, sessions] = await Promise.all([
      Project.where({ organizationId: organization!.id }).count(),
      OrganizationMember.where({ organizationId: organization!.id }).count(),
      VerificationSession.where({ organizationId: organization!.id }).count(),
    ])

    return new AdminOrganizationDetailResource({
      id: organization!.id,
      name: organization!.name,
      slug: organization!.slug,
      logoUrl: organization!.logoUrl,
      createdAt: organization!.createdAt,
      counts: { projects, members, sessions },
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
}
