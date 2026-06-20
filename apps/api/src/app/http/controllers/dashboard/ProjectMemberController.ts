import { RequestException } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import { Project } from '@app/models/Project'
import { ProjectMember } from '@app/models/ProjectMember'
import { Role } from '@app/models/Role'
import { TenantMember } from '@app/models/TenantMember'
import ProjectMemberCollection from '@app/http/resources/ProjectMemberCollection'
import ProjectMemberResource from '@app/http/resources/ProjectMemberResource'

/**
 * Manage which tenant members belong to a project and in what role. All actions
 * are scoped to a project the active tenant owns.
 */
export default class ProjectMemberController extends BaseController {
  /**
   * List a project's members with their user + role eager-loaded (no N+1).
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.tenant`).
   * @returns      A ProjectMemberCollection.
   */
  async index ({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const members = await ProjectMember.where({ projectId: project.id })
      .with(['user', 'role'])
      .get()

    return new ProjectMemberCollection(members).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Add an existing tenant member to the project with a role.
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.tenant`).
   * @returns      The created ProjectMemberResource (HTTP 201).
   */
  async store ({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const data = await this.validate({
      user_id: ['required', 'string'],
      role_id: ['required', 'string'],
    })

    await this.assertTenantMember(req.tenant!.id, data.user_id)
    await this.assertTenantRole(req.tenant!.id, data.role_id)

    const existing = await ProjectMember.where({ projectId: project.id, userId: data.user_id }).first()
    RequestException.abortIf(existing, 'User is already a member of this project', 409)

    const member = await ProjectMember.create({
      tenantId: project.tenantId,
      projectId: project.id,
      userId: data.user_id,
      roleId: data.role_id,
      status: 'active',
    })

    return new ProjectMemberResource(member)
      .additional({
        status: 'success',
        message: 'Project member added',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Change a project member's role.
   *
   * @param   ctx  The HTTP context (`:projectId`, `:memberId`, `req.tenant`).
   * @returns      The updated ProjectMemberResource.
   */
  async update ({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const data = await this.validate({ role_id: ['required', 'string'] })

    await this.assertTenantRole(req.tenant!.id, data.role_id)
    const member = await ProjectMember.where({
      id: req.params.memberId,
      projectId: project.id,
    }).firstOrFail()

    member.roleId = data.role_id
    await member.save()

    return new ProjectMemberResource(member).additional({
      status: 'success',
      message: 'Project member updated',
      code: 200,
    })
  }

  /**
   * Remove a member from the project.
   *
   * @param   ctx  The HTTP context (`:projectId`, `:memberId`, `req.tenant`).
   * @returns      An empty success envelope.
   */
  async destroy ({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const member = await ProjectMember.where({
      id: req.params.memberId,
      projectId: project.id,
    }).firstOrFail()
    await member.delete()

    return new ProjectMemberResource(member).additional({
      status: 'success',
      message: 'Project member removed',
      code: 200,
    })
  }

  /** Resolve the route's project, scoped to the active tenant (404 otherwise). */
  private scopedProject (req: HttpContext['req']) {
    return Project.where({ id: req.params.projectId, tenantId: req.tenant!.id }).firstOrFail()
  }

  /** A project member must already be an active member of the tenant. */
  private async assertTenantMember (tenantId: string, userId: string): Promise<void> {
    const member = await TenantMember.where({ tenantId, userId, status: 'active' }).first()
    RequestException.assertFound(member, 'user_id is not an active member of this tenant', 422)
  }

  /** A role assigned to a project member must belong to the tenant. */
  private async assertTenantRole (tenantId: string, roleId: string): Promise<void> {
    const role = await Role.where({ id: roleId, tenantId }).first()
    RequestException.assertFound(role, 'role_id is not a role of this tenant', 422)
  }
}
