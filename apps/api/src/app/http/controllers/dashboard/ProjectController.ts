import { RequestException, perPage } from '@arkstack/common'

import { BaseController } from '@controllers/BaseController'
import { HttpContext } from 'clear-router/types/express'
import { Project } from '@app/models/Project'
import { DEFAULT_PRIMARY_COLOR, type ProjectBranding } from '@arkyc/types'
import ProjectCollection from '@app/http/resources/ProjectCollection'
import ProjectResource from '@app/http/resources/ProjectResource'
import { type FileLike, Storage } from '@arkstack/filesystem'
import { Str } from '@h3ravel/support'
import { normalizeVelocitySettings, mergeThresholds } from 'src/support/risk-settings'
import { audit } from '@app/services/AuditLogger'
import { DeletionJob } from '@app/jobs'
import { ValidationException } from 'kanun'
import { GenericResource } from 'resora'

export default class ProjectController extends BaseController {
  /**
   * List the active organization's projects.
   *
   * @param   ctx  The HTTP context (`req.organization`).
   * @returns      A ProjectCollection.
   */
  async index({ req }: HttpContext) {
    const projects = await Project.where({ organizationId: req.organization!.id })
      .withExists({ 'accessGrants as hasAiGrant': (e) => e.where({ status: 'granted', capability: 'ai' }) })
      .paginate(perPage(req.query))

    return new ProjectCollection(projects).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Create a project under the active organization.
   *
   * @param   ctx  The HTTP context (`req.organization`).
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
      await Project.where({ organizationId: req.organization!.id, slug }).first(),
      'A project with this slug already exists in this organization',
      409,
    )

    const project = await Project.create({
      organizationId: req.organization!.id,
      name: data.name,
      slug,
      environment: data.environment ?? 'production',
      settings: data.settings ?? {},
      branding: { primary_color: DEFAULT_PRIMARY_COLOR, ...((data.branding as ProjectBranding | null) ?? {}) },
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
   * Show a project scoped to the active organization.
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.organization`).
   * @returns      A ProjectResource.
   */
  async show({ req }: HttpContext) {
    const project = await Project.where({
      id: req.params.projectId,
      organizationId: req.organization!.id,
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
   * @param   ctx  The HTTP context (`:projectId`, `req.organization`).
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
      organizationId: req.organization!.id,
    }).firstOrFail()

    if (data.name) project.name = data.name

    if (data.status) project.status = data.status

    if (data.settings && typeof data.settings === 'object') {
      const settings = { ...(data.settings as Record<string, unknown>) }

      if ('velocity' in settings) settings.velocity = normalizeVelocitySettings(settings.velocity)
      project.settings = { ...(project.settings ?? {}), ...settings }
    }

    if (data.branding && typeof data.branding === 'object') {
      const { logo_key: _logoKey, ...branding } = data.branding as ProjectBranding

      project.branding = { ...(project.branding ?? {}), ...branding }
      // An explicit logo_url (including null) replaces the uploaded logo.
      if ('logo_url' in branding) delete project.branding.logo_key
    }

    if (data.thresholds && typeof data.thresholds === 'object') {
      project.settings = {
        ...(project.settings ?? {}),
        thresholds: mergeThresholds(project.settings?.thresholds, data.thresholds),
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

  /**
   * Upload a project logo (multipart `logo`). Its object key is written to
   * `branding.logo_key`; responses resolve it to `branding.logo_url` (signed on a
   * private disk) so the widget can render it.
   */
  async uploadLogo({ req }: HttpContext) {
    const data = await this.validate({
      logo: ['required', 'file', 'image', 'mimes:.png,.jpg,.jpeg', 'max:2048'],
    })

    const project = await Project.where({
      id: req.params.projectId,
      organizationId: req.organization!.id,
    }).firstOrFail()

    const logo = data.logo as FileLike
    const ext = logo.mimetype === 'image/png' ? 'png' : 'jpg'
    const key = `organizations/${project.organizationId}/projects/${project.id}/branding/logo.${ext}`

    await Storage.disk().put(key, logo, { visibility: 'public', contentType: logo.mimetype })

    const { logo_url: _logoUrl, logo_key: previousKey, ...branding } = project.branding ?? {}

    project.branding = { ...branding, logo_key: key }
    await project.save()

    // A logo of the other image type was stored under a different extension.
    if (previousKey && previousKey !== key) {
      await Storage.disk()
        .delete(previousKey)
        .catch(() => undefined)
    }

    await audit.recordForRequest(req, {
      projectId: project.id,
      action: 'project.logo_uploaded',
      entityType: 'project',
      entityId: project.id,
    })

    return new ProjectResource(project).additional({
      status: 'success',
      message: 'Logo uploaded',
      code: 200,
    })
  }

  /**
   * Permanently delete a project and everything attached to it, including its
   * sessions. The caller confirms by typing the project's name.
   *
   * @param   ctx  The HTTP context (`:projectId`, `req.organization`).
   * @returns      The deleted project's id.
   */
  async destroy({ req }: HttpContext) {
    const data = await this.validate({ name: ['required', 'string'] })
    const project = await Project.where({
      id: req.params.projectId,
      organizationId: req.organization!.id,
    }).firstOrFail()

    if (String(data.name).trim() !== project.name) {
      throw ValidationException.withMessages({ name: ['Type the project name exactly to confirm.'] })
    }

    await audit.recordForRequest(req, {
      action: 'project.deleted',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.name },
    })
    await DeletionJob.dispatch('project', project.id)

    return new GenericResource({ id: project.id }).additional({
      status: 'success',
      message: 'Project deleted',
      code: 200,
    })
  }
}
