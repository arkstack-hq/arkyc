import { BaseController } from '@controllers/BaseController'
import { DeletionJob } from '@app/jobs'
import { GenericResource } from 'resora'
import { HttpContext } from 'clear-router/types/express'
import { Organization } from '@app/models/Organization'
import OrganizationCollection from '@app/http/resources/OrganizationCollection'
import { OrganizationMember } from '@app/models/OrganizationMember'
import OrganizationResource from '@app/http/resources/OrganizationResource'
import { PermissionSync } from '@arkyc/permissions'
import { RequestException } from '@arkstack/common'
import { Role } from '@app/models/Role'
import { Str } from '@h3ravel/support'
import { ValidationException } from 'kanun'
import { audit } from '@app/services/AuditLogger'
import { normalizeFaceEmbeddingSettings } from 'src/support/risk-settings'
import { permissionStore } from '@app/services/ArkormPermissionStore'
import { platformAudit } from '@app/services/PlatformAuditLogger'
import { toArray } from 'src/support/collection'

/** Organization management. `show`/`update` run after `resolveOrganization` (req.organization). */
export default class OrganizationController extends BaseController {
  /**
   * List the organizations the authenticated user belongs to.
   *
   * @param   ctx  The HTTP context (`req.user`).
   * @returns      A OrganizationCollection.
   */
  async index({ req }: HttpContext) {
    const memberships = await OrganizationMember.where({ userId: req.user!.id }).with('organization').get()
    const organizations = toArray(memberships)
      .map((m) => m.getAttribute('organization') as Organization | null)
      .filter((t): t is Organization => t != null)

    return new OrganizationCollection(organizations).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Create an organization, seed its system roles/permissions, and make the creator
   * its owner.
   *
   * @param   ctx  The HTTP context (`req.user` becomes the owner).
   * @returns      A OrganizationResource (HTTP 201).
   */
  async create({ req }: HttpContext) {
    const data = await this.validate({
      name: ['required', 'string', 'min:2'],
      slug: ['nullable', 'string'],
    })

    const slug = (data.slug || Str.slug(data.name)).toLowerCase()

    RequestException.abortIf(
      await Organization.where({ slug }).first(),
      'An organization with this slug already exists',
      409,
    )

    const organization = await Organization.create({ name: data.name, slug, settings: {} })

    await PermissionSync.permissions(permissionStore)
    await PermissionSync.roles(organization.id, permissionStore)
    const ownerRole = await Role.where({ organizationId: organization.id, slug: 'owner' }).first()

    await OrganizationMember.create({
      organizationId: organization.id,
      userId: req.user!.id,
      roleId: ownerRole!.id,
      status: 'active',
      joinedAt: new Date(),
    })

    const actor = audit.actorFromRequest(req)

    await audit.record({
      organizationId: organization.id,
      actorId: actor.actorId,
      actorType: actor.actorType,
      action: 'organization.created',
      entityType: 'organization',
      entityId: organization.id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    })

    return new OrganizationResource(organization)
      .additional({
        status: 'success',
        message: 'Organization created',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Show the active (resolved) organization.
   *
   * @param   ctx  The HTTP context (`req.organization`).
   * @returns      A OrganizationResource.
   */
  async show({ req }: HttpContext) {
    return new OrganizationResource(req.organization!).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Update the active organization's profile/settings.
   *
   * @param   ctx  The HTTP context (`req.organization`).
   * @returns      A OrganizationResource.
   */
  async update({ req }: HttpContext) {
    const data = await this.validate({
      name: ['nullable', 'string'],
      logo_url: ['nullable', 'string'],
      settings: ['nullable'],
    })

    const organization = req.organization!

    if (data.name) organization.name = data.name

    if (data.logo_url !== undefined) organization.logoUrl = data.logo_url

    if (data.settings && typeof data.settings === 'object') {
      const settings = { ...(data.settings as Record<string, unknown>) }

      if ('face_embeddings' in settings) {
        settings.face_embeddings = normalizeFaceEmbeddingSettings(settings.face_embeddings)
      }
      organization.settings = { ...(organization.settings ?? {}), ...settings }
    }
    await organization.save()

    await audit.recordForRequest(req, {
      action: 'organization.updated',
      entityType: 'organization',
      entityId: organization.id,
    })

    return new OrganizationResource(organization).additional({
      status: 'success',
      message: 'Organization updated',
      code: 200,
    })
  }

  /**
   * Permanently delete the active organization, its projects and everything
   * attached to them. The caller confirms by typing the organization's name.
   *
   * @param   ctx  The HTTP context (`req.organization`).
   * @returns      The deleted organization's id.
   */
  async destroy({ req }: HttpContext) {
    const data = await this.validate({ name: ['required', 'string'] })
    const organization = req.organization!

    if (organization.deletionRequestedAt) {
      throw new RequestException('This organization is already queued for deletion.', 409)
    }

    if (String(data.name).trim() !== organization.name) {
      throw ValidationException.withMessages({
        name: ['Type the organization name exactly to confirm.'],
      })
    }

    // Recorded at platform level: the organization's own audit log is deleted with it.
    await platformAudit.recordForRequest(req, {
      action: 'organization.deleted',
      entityType: 'organization',
      entityId: organization.id,
      metadata: { name: organization.name, slug: organization.slug },
    })

    organization.deletionRequestedAt = new Date()
    await organization.save()
    await DeletionJob.dispatch('organization', organization.id)

    return new GenericResource({
      id: organization.id,
      deletion_requested_at: organization.deletionRequestedAt,
    }).additional({
      status: 'success',
      message: 'Organization queued for deletion',
      code: 200,
    })
  }
}
