import { RequestException, perPage } from '@arkstack/common'

import { BaseController } from '@controllers/BaseController'
import { HttpContext } from 'clear-router/types/express'
import { Project } from '@app/models/Project'
import { ProjectMember } from '@app/models/ProjectMember'
import ProjectMemberCollection from '@app/http/resources/ProjectMemberCollection'
import ProjectMemberResource from '@app/http/resources/ProjectMemberResource'
import { Role } from '@app/models/Role'
import { OrganizationMember } from '@app/models/OrganizationMember'
import { audit } from '@app/services/AuditLogger'

/**
 * Manage which organization members belong to a project and in what role. All actions
 * are scoped to a project the active organization owns.
 */
export default class ProjectMemberController extends BaseController {
  /**
   * List a project's members with their user + role eager-loaded (no N+1).
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.organization`).
   * @returns      A ProjectMemberCollection.
   */
  async index({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const members = await ProjectMember.where({ projectId: project.id })
      .with(['user', 'role'])
      .paginate(perPage(req.query))

    return new ProjectMemberCollection(members).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Add an existing organization member to the project with a role.
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.organization`).
   * @returns      The created ProjectMemberResource (HTTP 201).
   */
  async store({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const data = await this.validate({
      user_id: ['required', 'string'],
      role_id: ['required', 'string'],
    })

    await this.assertOrganizationMember(req.organization!.id, data.user_id)
    await this.assertOrganizationRole(req.organization!.id, data.role_id)

    const existing = await ProjectMember.where({
      projectId: project.id,
      userId: data.user_id,
    }).first()
    RequestException.abortIf(existing, 'User is already a member of this project', 409)

    const member = await ProjectMember.create({
      organizationId: project.organizationId,
      projectId: project.id,
      userId: data.user_id,
      roleId: data.role_id,
      status: 'active',
    })

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'project_member.added',
      entityType: 'project_member',
      entityId: member.id,
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
   * @param   ctx  The HTTP context (`:projectId`, `:memberId`, `req.organization`).
   * @returns      The updated ProjectMemberResource.
   */
  async update({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const data = await this.validate({ role_id: ['required', 'string'] })

    await this.assertOrganizationRole(req.organization!.id, data.role_id)
    const member = await ProjectMember.where({
      id: req.params.memberId,
      projectId: project.id,
    }).firstOrFail()

    member.roleId = data.role_id
    await member.save()

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'project_member.updated',
      entityType: 'project_member',
      entityId: member.id,
    })

    return new ProjectMemberResource(member).additional({
      status: 'success',
      message: 'Project member updated',
      code: 200,
    })
  }

  /**
   * Remove a member from the project.
   *
   * @param   ctx  The HTTP context (`:projectId`, `:memberId`, `req.organization`).
   * @returns      An empty success envelope.
   */
  async destroy({ req }: HttpContext) {
    const project = await this.scopedProject(req)
    const member = await ProjectMember.where({
      id: req.params.memberId,
      projectId: project.id,
    }).firstOrFail()
    await member.delete()

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'project_member.removed',
      entityType: 'project_member',
      entityId: member.id,
    })

    return new ProjectMemberResource(member).additional({
      status: 'success',
      message: 'Project member removed',
      code: 200,
    })
  }

  /** Resolve the route's project, scoped to the active organization (404 otherwise). */
  private scopedProject(req: HttpContext['req']) {
    return Project.where({ id: req.params.projectId, organizationId: req.organization!.id }).firstOrFail()
  }

  /** A project member must already be an active member of the organization. */
  private async assertOrganizationMember(organizationId: string, userId: string): Promise<void> {
    const member = await OrganizationMember.where({ organizationId, userId, status: 'active' }).first()
    RequestException.assertFound(member, 'user_id is not an active member of this organization', 422)
  }

  /** A role assigned to a project member must belong to the organization. */
  private async assertOrganizationRole(organizationId: string, roleId: string): Promise<void> {
    const role = await Role.where({ id: roleId, organizationId }).first()
    RequestException.assertFound(role, 'role_id is not a role of this organization', 422)
  }
}
