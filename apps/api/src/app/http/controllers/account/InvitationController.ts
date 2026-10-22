import { RequestException, perPage } from '@arkstack/common'

import { BaseController } from '@controllers/BaseController'
import CountResource from '@app/http/resources/CountResource'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import PendingInvitationCollection from '@app/http/resources/PendingInvitationCollection'
import type { User } from '@app/models/User'
import { invitations } from '@app/services/InvitationService'

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
   * How many pending invitations the user has (drives the nav badge). Zero until
   * the email is verified, since invitations can't be accepted before then.
   *
   * @param ctx
   * @returns
   */
  async count({ req }: HttpContext) {
    const user = req.user! as User
    const count = user.emailVerifiedAt ? await invitations.pendingFor(user).count() : 0

    return new CountResource({ count }).additional({
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
