import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import { VerificationSession } from '@app/models/VerificationSession'
import VerificationSessionResource from '@app/http/resources/VerificationSessionResource'
import { sessionService } from '@app/services/VerificationSessionService'

/**
 * Public Project API (secret API key). Lets an integrating backend open a
 * verification session, check its state, and cancel it. `req.projectContext` is
 * resolved by `apiKeyAuth`.
 */
export default class SessionController extends BaseController {
  /**
   * Open a verification session and mint its one-time client token.
   *
   * @returns A VerificationSessionResource plus the `client_token` (HTTP 201).
   */
  async create ({ req }: HttpContext) {
    const data = await this.validate({
      user_reference: ['nullable', 'string'],
      metadata: ['nullable'],
    })

    const { session, clientToken } = await sessionService.create(req.projectContext!, {
      userReference: data.user_reference ?? null,
      metadata: data.metadata ?? null,
    })

    return new VerificationSessionResource(session)
      .additional({
        status: 'success',
        message: 'Verification session created',
        code: 201,
        client_token: clientToken,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Fetch a session owned by the authenticated project.
   *
   * @returns A VerificationSessionResource.
   */
  async show ({ req }: HttpContext) {
    const session = await this.scopedSession(req.projectContext!.project_id, req.params.id)
    await sessionService.refresh(session)

    return new VerificationSessionResource(session)
      .additional({
        status: 'success',
        message: 'OK',
        code: 200,
      })
  }

  /**
   * Cancel a non-terminal session owned by the authenticated project.
   *
   * @returns The cancelled VerificationSessionResource.
   */
  async cancel ({ req }: HttpContext) {
    const session = await this.scopedSession(req.projectContext!.project_id, req.params.id)
    await sessionService.cancel(session)

    return new VerificationSessionResource(session)
      .additional({
        status: 'success',
        message: 'Verification session cancelled',
        code: 200,
      })
  }

  /** Resolve a session by id, scoped to the authenticated project (404 otherwise). */
  private scopedSession (projectId: string, id: string | string[] | undefined) {
    return VerificationSession.where({ id: Array.isArray(id) ? id[0] : id, projectId }).firstOrFail()
  }
}
