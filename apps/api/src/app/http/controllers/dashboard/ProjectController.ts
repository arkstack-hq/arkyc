import { RequestException } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import { HttpContext } from 'clear-router/types/express'
import { Project } from '@app/models/Project'
import ProjectCollection from '@app/http/resources/ProjectCollection'
import ProjectResource from '@app/http/resources/ProjectResource'
import { Str } from '@h3ravel/support'
import { audit } from '@app/services/AuditLogger'

export default class ProjectController extends BaseController {
  /**
   * List the active tenant's projects.
   *
   * @param   ctx  The HTTP context (`req.tenant`).
   * @returns      A ProjectCollection.
   */
  async index({ req }: HttpContext) {
    const projects = await Project.where({ tenantId: req.tenant!.id }).get()

    return new ProjectCollection(projects).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Create a project under the active tenant.
   *
   * @param   ctx  The HTTP context (`req.tenant`).
   * @returns      A ProjectResource (HTTP 201).
   */
  async create({ req }: HttpContext) {
    const data = await this.validate({
      name: ['required', 'string', 'min:2'],
      slug: ['nullable', 'string'],
      environment: ['nullable', 'in:production,staging,development'],
      settings: ['nullable'],
      branding: ['nullable'],
    })

    const slug = (data.slug || Str.slug(data.name)).toLowerCase()
    RequestException.abortIf(
      await Project.where({ tenantId: req.tenant!.id, slug }).first(),
      'A project with this slug already exists in this tenant',
      409,
    )

    const project = await Project.create({
      tenantId: req.tenant!.id,
      name: data.name,
      slug,
      environment: data.environment ?? 'production',
      settings: data.settings ?? {},
      branding: data.branding ?? {},
      status: 'active',
    })

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
    })

    return new ProjectResource(project)
      .additional({
        status: 'success',
        message: 'Project created',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Show a project scoped to the active tenant.
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.tenant`).
   * @returns      A ProjectResource.
   */
  async show({ req }: HttpContext) {
    const project = await Project.where({
      id: req.params.projectId,
      tenantId: req.tenant!.id,
    }).firstOrFail()

    return new ProjectResource(project).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Update a project's name/status/settings/branding/thresholds.
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.tenant`).
   * @returns      A ProjectResource.
   */
  async update({ req }: HttpContext) {
    const data = await this.validate({
      name: ['nullable', 'string'],
      status: ['nullable', 'in:active,paused,archived'],
      settings: ['nullable'],
      branding: ['nullable'],
      thresholds: ['nullable'],
    })

    const project = await Project.where({
      id: req.params.projectId,
      tenantId: req.tenant!.id,
    }).firstOrFail()
    if (data.name) project.name = data.name
    if (data.status) project.status = data.status
    if (data.settings && typeof data.settings === 'object') {
      project.settings = { ...(project.settings ?? {}), ...data.settings }
    }
    if (data.branding && typeof data.branding === 'object') {
      project.branding = { ...(project.branding ?? {}), ...data.branding }
    }
    if (data.thresholds && typeof data.thresholds === 'object') {
      project.settings = {
        ...(project.settings ?? {}),
        thresholds: { ...(project.settings?.thresholds ?? {}), ...data.thresholds },
      }
    }
    await project.save()

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'project.updated',
      entityType: 'project',
      entityId: project.id,
    })

    return new ProjectResource(project).additional({
      status: 'success',
      message: 'Project updated',
      code: 200,
    })
  }
}
