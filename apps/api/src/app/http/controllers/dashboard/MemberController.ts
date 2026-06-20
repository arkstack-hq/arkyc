import { AppException } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { Resource } from 'resora'
import { createTokenPair } from '@arkyc/auth'
import { resolvePermissions } from '@arkyc/permissions'
import { BaseController } from '@controllers/BaseController'
import { permissionStore } from '@app/services/ArkormPermissionStore'
import { directPermissionNames, rolePermissionNames } from '@app/services/permission-queries'
import MemberCollection from '@app/http/resources/MemberCollection'
import InvitationResource from '@app/http/resources/InvitationResource'
import EmptyResource from '@app/http/resources/EmptyResource'
import { TenantMember } from '@app/models/TenantMember'
import { TenantInvitation } from '@app/models/TenantInvitation'
import { Role } from '@app/models/Role'
import { Permission } from '@app/models/Permission'
import { UserPermission } from '@app/models/UserPermission'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export default class MemberController extends BaseController {
    /**
     * List tenant members with their user + role eager-loaded (no N+1).
     *
     * @param   ctx  The HTTP context (`req.tenant`).
     * @returns      A MemberCollection.
     */
    async index ({ req }: HttpContext) {
        const members = await TenantMember.where({ tenantId: req.tenant!.id })
            .with(['user', 'role'])
            .get()

        return new MemberCollection(members).additional({ status: 'success', message: 'OK', code: 200 })
    }

    /**
     * Invite an email address to the tenant with a role (one-time token).
     *
     * @param   ctx  The HTTP context (`req.tenant`).
     * @returns      An InvitationResource plus the one-time `token` (HTTP 201).
     */
    async invite ({ req }: HttpContext) {
        const data = await this.validate({
            email: ['required', 'email'],
            role_id: ['required', 'string'],
        })

        const role = await Role.where({ id: data.role_id }).first()
        if (!role || role.tenantId !== req.tenant!.id) {
            throw new AppException('role_id is not a role of this tenant', 422)
        }

        const { token, tokenHash } = createTokenPair()
        const invitation = await TenantInvitation.create({
            tenantId: req.tenant!.id,
            email: data.email,
            roleId: role.id,
            tokenHash,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        })

        // The raw token is returned once so it can be delivered to the invitee.
        return new InvitationResource(invitation)
            .additional({ status: 'success', message: 'Invitation created', code: 201, token })
            .response()
            .setStatusCode(201)
    }

    /**
     * Resolve a member's role, direct, and effective permissions.
     *
     * @param   ctx  The HTTP context (`:memberId`, `req.tenant`).
     * @returns      A Resource of role/direct/effective permissions.
     */
    async showPermissions ({ req }: HttpContext) {
        const member = await TenantMember.where({ id: req.params.memberId, tenantId: req.tenant!.id }).firstOrFail()

        const [role_permissions, direct_permissions, effective_permissions] = await Promise.all([
            rolePermissionNames(member.roleId),
            directPermissionNames(member.userId, member.tenantId),
            resolvePermissions({ userId: member.userId, tenantId: member.tenantId }, permissionStore),
        ])

        return new Resource({
            role_id: member.roleId,
            role_permissions,
            direct_permissions,
            effective_permissions,
        }).additional({ status: 'success', message: 'OK', code: 200 })
    }

    /**
     * Assign a different role to a member.
     *
     * @param   ctx  The HTTP context (`:memberId`, `req.tenant`).
     * @returns      An EmptyResource.
     */
    async assignRole ({ req }: HttpContext) {
        const member = await TenantMember.where({ id: req.params.memberId, tenantId: req.tenant!.id }).firstOrFail()
        const data = await this.validate({ role_id: ['required', 'string'] })

        const role = await Role.where({ id: data.role_id }).first()
        if (!role || role.tenantId !== req.tenant!.id) {
            throw new AppException('role_id is not a role of this tenant', 422)
        }

        member.roleId = role.id
        await member.save()

        return new EmptyResource({}).additional({ status: 'success', message: 'Role assigned', code: 200 })
    }

    /**
     * Grant a direct (tenant-level) permission to a member.
     *
     * @param   ctx  The HTTP context (`:memberId`, `req.tenant`).
     * @returns      An EmptyResource.
     */
    async addPermission ({ req }: HttpContext) {
        const member = await TenantMember.where({ id: req.params.memberId, tenantId: req.tenant!.id }).firstOrFail()
        const data = await this.validate({ permission: ['required', 'string'] })

        const perm = await Permission.where({ name: data.permission }).first()
        if (!perm) throw new AppException('Unknown permission', 422)

        const existing = await UserPermission.where({
            tenantId: member.tenantId,
            userId: member.userId,
            permissionId: perm.id,
        }).first()
        if (!existing) {
            await UserPermission.create({
                tenantId: member.tenantId,
                projectId: null,
                userId: member.userId,
                permissionId: perm.id,
            })
        }

        return new EmptyResource({}).additional({ status: 'success', message: 'Permission granted', code: 200 })
    }

    /**
     * Revoke a member's direct permission.
     *
     * @param   ctx  The HTTP context (`:memberId`, `:permission`, `req.tenant`).
     * @returns      An EmptyResource.
     */
    async removePermission ({ req }: HttpContext) {
        const member = await TenantMember.where({ id: req.params.memberId, tenantId: req.tenant!.id }).firstOrFail()
        const name = req.params.permission

        const perm = name ? await Permission.where({ name }).first() : null
        if (!perm) throw new AppException('Unknown permission', 404)

        const grant = await UserPermission.where({
            tenantId: member.tenantId,
            userId: member.userId,
            permissionId: perm.id,
        }).first()
        if (grant) await grant.delete()

        return new EmptyResource({}).additional({ status: 'success', message: 'Permission revoked', code: 200 })
    }
}
