import { HttpContext } from 'clear-router/types/express'
import { RequestException, perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import { invitations } from '@app/services/InvitationService'
import type { User } from '@app/models/User'
import PendingInvitationCollection from '@app/http/resources/PendingInvitationCollection'
import EmptyResource from '@app/http/resources/EmptyResource'

/** Invitations addressed to the signed-in user, accepted without the link token. */
export default class InvitationController extends BaseController {
  /**
   * List pending invitations for the user's verified email.
   *
   * @param ctx
   * @returns
   */
  async index({ req }: HttpContext) {
    const user = this.verifiedUser(req.user!)

    const pending = await invitations
      .pendingFor(user)
      .with(['organization', 'role'])
      .latest('createdAt')
      .paginate(perPage(req.query))

    return new PendingInvitationCollection(pending).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Accept one of the user's pending invitations.
   *
   * @param ctx
   * @returns
   */
  async accept({ req }: HttpContext) {
    const user = this.verifiedUser(req.user!)
    const invitation = await invitations.pendingFor(user).where({ id: req.params.id }).firstOrFail()

    await invitations.accept(invitation, user)

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'Invitation accepted',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Only a verified email may see or accept invitations without the link token.
   *
   * @param user
   * @returns
   */
  private verifiedUser(user: User): User {
    RequestException.abortIf(!user.emailVerifiedAt, 'Verify your email address to view your invitations', 403)

    return user
  }
}
