import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import { RequestException } from '@arkstack/common'
import { OrganizationInvitation } from '@app/models/OrganizationInvitation'
import { OrganizationMember } from '@app/models/OrganizationMember'
import { Token } from '@arkyc/auth'

/** Accept an organization invitation as the authenticated user. */
export default class InvitationController extends BaseController {
  /**
   * Accept an invitation by its raw token and join the organization.
   *
   * @param   ctx  The HTTP context (the accepting user is `req.user`).
   * @returns      An EmptyResource confirming acceptance.
   */
  async create({ req }: HttpContext) {
    const data = await this.validate({ token: ['required', 'string'] })
    const user = req.user!

    const invitation = await OrganizationInvitation.where({ tokenHash: Token.hash(data.token) })
      .whereNull('acceptedAt')
      .firstOrFail()
    RequestException.abortIf(new Date(invitation.expiresAt).getTime() <= Date.now(), 'Invitation has expired', 410)
    RequestException.abortIf(invitation.email !== user.email, 'This invitation is for a different email', 403)

    await OrganizationMember.query().firstOrCreate(
      { userId: user.id, organizationId: invitation.organizationId },
      {
        roleId: invitation.roleId,
        status: 'active',
        joinedAt: new Date(),
      },
    )

    invitation.acceptedAt = new Date()
    await invitation.save()

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Invitation accepted',
      code: 200,
    })
  }
}
