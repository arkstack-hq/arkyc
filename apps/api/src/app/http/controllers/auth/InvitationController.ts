import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import { OrganizationInvitation } from '@app/models/OrganizationInvitation'
import { Token } from '@arkyc/auth'
import { invitations } from '@app/services/InvitationService'

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

    await invitations.accept(invitation, user)

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Invitation accepted',
      code: 200,
    })
  }
}
