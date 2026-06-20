import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import { RequestException } from '@arkstack/common'
import { TenantInvitation } from '@app/models/TenantInvitation'
import { TenantMember } from '@app/models/TenantMember'
import { hashToken } from '@arkyc/auth'

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

    const invitation = await TenantInvitation
      .where({ tokenHash: hashToken(data.token) })
      .whereNull('acceptedAt')
      .firstOrFail()
    RequestException.abortIf(
      new Date(invitation.expiresAt).getTime() <= Date.now(),
      'Invitation has expired',
      410
    )
    RequestException.abortIf(
      invitation.email !== user.email,
      'This invitation is for a different email',
      403
    )

    await TenantMember.query().firstOrCreate(
      { userId: user.id, tenantId: invitation.tenantId },
      {
        roleId: invitation.roleId,
        status: 'active',
        joinedAt: new Date(),
      }
    )

    invitation.acceptedAt = new Date()
    await invitation.save()

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'Invitation accepted',
        code: 200,
      })
  }
}
