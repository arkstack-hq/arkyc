import { RequestException } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { Str } from '@h3ravel/support'
import { syncDefaultPermissions, syncDefaultRoles } from '@arkyc/permissions'
import { BaseController } from '@controllers/BaseController'
import { permissionStore } from '@app/services/ArkormPermissionStore'
import TenantResource from '@app/http/resources/TenantResource'
import TenantCollection from '@app/http/resources/TenantCollection'
import { toArray } from 'src/support/collection'
import { Tenant } from '@app/models/Tenant'
import { TenantMember } from '@app/models/TenantMember'
import { Role } from '@app/models/Role'
import { audit } from '@app/services/AuditLogger'

/** Tenant management. `show`/`update` run after `resolveTenant` (req.tenant). */
export default class TenantController extends BaseController {
    /**
     * List the tenants the authenticated user belongs to.
     *
     * @param   ctx  The HTTP context (`req.user`).
     * @returns      A TenantCollection.
     */
    async index ({ req }: HttpContext) {
        const memberships = await TenantMember.where({ userId: req.user!.id }).with('tenant').get()
        const tenants = toArray(memberships)
            .map((m) => m.getAttribute('tenant') as Tenant | null)
            .filter((t): t is Tenant => t != null)

        return new TenantCollection(tenants).additional({
          status: 'success',
          message: 'OK',
          code: 200,
        })
    }

    /**
     * Create a tenant, seed its system roles/permissions, and make the creator
     * its owner.
     *
     * @param   ctx  The HTTP context (`req.user` becomes the owner).
     * @returns      A TenantResource (HTTP 201).
     */
    async create ({ req }: HttpContext) {
        const data = await this.validate({
            name: ['required', 'string', 'min:2'],
            slug: ['nullable', 'string'],
        })

        const slug = (data.slug || Str.slug(data.name)).toLowerCase()
        RequestException.abortIf(
            await Tenant.where({ slug }).first(),
            'A tenant with this slug already exists',
            409,
        )

        const tenant = await Tenant.create({ name: data.name, slug, settings: {} })

        await syncDefaultPermissions(permissionStore)
        await syncDefaultRoles(tenant.id, permissionStore)
        const ownerRole = await Role.where({ tenantId: tenant.id, slug: 'owner' }).first()
        await TenantMember.create({
            tenantId: tenant.id,
            userId: req.user!.id,
            roleId: ownerRole!.id,
            status: 'active',
            joinedAt: new Date(),
        })

        const actor = audit.actorFromRequest(req)
        await audit.record({
            tenantId: tenant.id,
            actorId: actor.actorId,
            actorType: actor.actorType,
            action: 'tenant.created',
            entityType: 'tenant',
            entityId: tenant.id,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
        })

        return new TenantResource(tenant)
            .additional({
              status: 'success',
              message: 'Tenant created',
              code: 201,
            })
            .response()
            .setStatusCode(201)
    }

    /**
     * Show the active (resolved) tenant.
     *
     * @param   ctx  The HTTP context (`req.tenant`).
     * @returns      A TenantResource.
     */
    async show ({ req }: HttpContext) {
        return new TenantResource(req.tenant!).additional({
          status: 'success',
          message: 'OK',
          code: 200,
        })
    }

    /**
     * Update the active tenant's profile/settings.
     *
     * @param   ctx  The HTTP context (`req.tenant`).
     * @returns      A TenantResource.
     */
    async update ({ req }: HttpContext) {
        const data = await this.validate({
            name: ['nullable', 'string'],
            logo_url: ['nullable', 'string'],
            settings: ['nullable'],
        })

        const tenant = req.tenant!
        if (data.name) tenant.name = data.name
        if (data.logo_url !== undefined) tenant.logoUrl = data.logo_url
        if (data.settings && typeof data.settings === 'object') {
            tenant.settings = { ...(tenant.settings ?? {}), ...data.settings }
        }
        await tenant.save()

        await audit.recordForRequest(req, {
            action: 'tenant.updated',
            entityType: 'tenant',
            entityId: tenant.id,
        })

        return new TenantResource(tenant).additional({
          status: 'success',
          message: 'Tenant updated',
          code: 200,
        })
    }
}
