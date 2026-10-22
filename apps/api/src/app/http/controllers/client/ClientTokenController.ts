import { GenericResource } from 'resora'
import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import { Project } from '@app/models/Project'
import { clientTokens } from '@app/services/ClientTokenService'
import { readClientToken, readOrigin } from '@app/http/middlewares/ClientTokenMiddleware'
import { ApiException } from 'src/support/apiErrors'

/** Client token exchange for the widget: claiming single-use tokens and minting handoff tokens. */
export default class ClientTokenController extends BaseController {
  /**
   * Exchange a single-use launch or handoff token for this browser's device token.
   *
   * @param ctx
   * @returns
   */
  async claim({ req }: HttpContext) {
    const token = readClientToken(req)

    if (!token) throw new ApiException('missing_client_token')

    const claimed = await clientTokens.claim(token, readOrigin(req), {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    })

    return new GenericResource({ token: claimed.token, expires_at: claimed.expiresAt })
      .additional({
        status: 'success',
        message: 'Client token claimed',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Mint the single-use token the cross-device QR code carries. Replaces any
   * unclaimed one.
   *
   * @param ctx
   * @returns
   */
  async handoff({ req }: HttpContext) {
    const session = req.verificationSession!
    const project = await Project.where({ id: session.projectId }).first()

    if (!project?.settings?.handoff?.enabled) throw new ApiException('handoff_disabled')

    const token = await clientTokens.issue(session, 'handoff')

    return new GenericResource({ token, expires_at: session.expiresAt })
      .additional({
        status: 'success',
        message: 'Handoff token created',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }
}
