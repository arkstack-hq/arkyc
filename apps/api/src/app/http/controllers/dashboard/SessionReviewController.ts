import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import { VerificationSession } from '@app/models/VerificationSession'
import VerificationSessionResource from '@app/http/resources/VerificationSessionResource'
import SessionCollection from '@app/http/resources/SessionCollection'
import { audit } from '@app/services/AuditLogger'
import { type RetryKind, reviewService } from '@app/services/ReviewService'

const param = (value: unknown): string | undefined =>
  (Array.isArray(value) ? value[0] : value) as string | undefined

/**
 * Review queue + reviewer actions (Phase 9). All routes run after `resolveTenant`
 * and are gated by `sessions.view` / `reviews.*`.
 */
export default class SessionReviewController extends BaseController {
  /**
   * List the tenant's sessions, newest first. Filter by `status`,
   * `decision_reason`, or `project_id` query params.
   */
  async index ({ req }: HttpContext) {
    let query = VerificationSession.where({ tenantId: req.tenant!.id })
    const status = param(req.query.status)
    const decisionReason = param(req.query.decision_reason)
    const projectId = param(req.query.project_id)
    if (status) query = query.where({ status })
    if (decisionReason) query = query.where({ decisionReason })
    if (projectId) query = query.where({ projectId })

    const sessions = await query.latest('createdAt').paginate(perPage(req.query))

    return new SessionCollection(sessions).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Fetch a single session in the tenant. */
  async show ({ req }: HttpContext) {
    const session = await this.scoped(req)

    return new VerificationSessionResource(session).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Approve a session awaiting review. */
  async approve ({ req }: HttpContext) {
    const data = await this.validate({ reason: ['nullable', 'string'] })
    const session = await this.scoped(req)
    await reviewService.approve(session, audit.actorFromRequest(req), data.reason ?? undefined)

    return this.session(session, 'Session approved')
  }

  /** Reject a session awaiting review. */
  async reject ({ req }: HttpContext) {
    const data = await this.validate({ reason: ['nullable', 'string'] })
    const session = await this.scoped(req)
    await reviewService.reject(session, audit.actorFromRequest(req), data.reason ?? undefined)

    return this.session(session, 'Session rejected')
  }

  /** Send the session back for a document/selfie/full retry. */
  async requestRetry ({ req }: HttpContext) {
    const data = await this.validate({
      kind: ['required', 'string', 'in:document,selfie,full'],
      reason: ['nullable', 'string'],
    })
    const session = await this.scoped(req)
    await reviewService.requestRetry(session, audit.actorFromRequest(req), data.kind as RetryKind, data.reason ?? undefined)

    return this.session(session, 'Retry requested')
  }

  /** Attach a reviewer note (no status change). */
  async note ({ req }: HttpContext) {
    const data = await this.validate({ note: ['required', 'string'] })
    const session = await this.scoped(req)
    await reviewService.addNote(session, audit.actorFromRequest(req), data.note)

    return this.session(session, 'Note added')
  }

  /** Resolve a session by id, scoped to the active tenant (404 otherwise). */
  private scoped (req: HttpContext['req']) {
    return VerificationSession.where({ id: req.params.id, tenantId: req.tenant!.id }).firstOrFail()
  }

  private session (session: VerificationSession, message: string) {
    return new VerificationSessionResource(session).additional({
      status: 'success',
      message,
      code: 200,
    })
  }
}
