import { AppException } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { hashToken } from '@arkyc/auth'
import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { TenantInvitation } from '@app/models/TenantInvitation'
import { TenantMember } from '@app/models/TenantMember'

/** Accept a tenant invitation as the authenticated user. */
export default class InvitationController extends BaseController {
    /**
     * Accept an invitation by its raw token and join the tenant.
     *
     * @param   ctx  The HTTP context (the accepting user is `req.user`).
     * @returns      An EmptyResource confirming acceptance.
     */
    async create ({ req }: HttpContext) {
        const data = await this.validate({ token: ['required', 'string'] })
        const user = req.user!

        const invitation = await TenantInvitation.where({ tokenHash: hashToken(data.token) }).first()
        if (!invitation || invitation.acceptedAt) {
            throw new AppException('Invitation not found', 404)
        }
        if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
            throw new AppException('Invitation has expired', 410)
        }
        if (invitation.email !== user.email) {
            throw new AppException('This invitation is for a different email', 403)
        }

        const existing = await TenantMember.where({
            userId: user.id,
            tenantId: invitation.tenantId,
        }).first()
        if (!existing) {
            await TenantMember.create({
                tenantId: invitation.tenantId,
                userId: user.id,
                roleId: invitation.roleId,
                status: 'active',
                joinedAt: new Date(),
            })
        }

        invitation.acceptedAt = new Date()
        await invitation.save()

        return new EmptyResource({})
            .additional({ status: 'success', message: 'Invitation accepted', code: 200 })
    }
}
