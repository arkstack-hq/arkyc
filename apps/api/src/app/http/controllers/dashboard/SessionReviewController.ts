import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import { VerificationSession } from '@app/models/VerificationSession'
import VerificationSessionResource from '@app/http/resources/VerificationSessionResource'
import SessionCollection from '@app/http/resources/SessionCollection'
import { audit } from '@app/services/AuditLogger'
import { type RetryKind, reviewService } from '@app/services/ReviewService'
import { readObject } from 'src/support/storage'

const param = (value: unknown): string | undefined => (Array.isArray(value) ? value[0] : value) as string | undefined

/** Streamable session media: the artifact kind → its content type. */
const MEDIA_CONTENT_TYPE: Record<string, string> = {
  document_front: 'image/jpeg',
  document_back: 'image/jpeg',
  portrait: 'image/jpeg',
  selfie: 'image/jpeg',
  video: 'video/webm',
}

/**
 * Review queue + reviewer actions (Phase 9). All routes run after `resolveOrganization`
 * and are gated by `sessions.view` / `reviews.*`.
 */
export default class SessionReviewController extends BaseController {
  /**
   * List the organization's sessions, newest first. Filter by `status`,
   * `decision_reason`, or `project_id` query params.
   */
  async index({ req }: HttpContext) {
    let query = VerificationSession.where({ organizationId: req.organization!.id })
    const status = param(req.query.status)
    const decisionReason = param(req.query.decision_reason)
    const projectId = param(req.query.project_id)
    if (status) query = query.where({ status })
    if (decisionReason) query = query.where({ decisionReason })
    if (projectId) query = query.where({ projectId })

    // Eager-load OCR so the list can show the extracted person name under the reference.
    const sessions = await query.with('ocrResults').latest('createdAt').paginate(perPage(req.query))

    return new SessionCollection(sessions).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Fetch a single session with everything a reviewer needs: the OCR fields, the
   * document/liveness/face-match checks, and the list of available media (each
   * streamed by {@link media}, gated by `sessions.view`).
   */
  async show({ req, res }: HttpContext) {
    const session = await this.scoped(req)
    const [document, ocr, liveness, faceMatch, portrait] = await Promise.all([
      session.documentCaptures().latest('createdAt').first(),
      session.ocrResults().latest('createdAt').first(),
      session.livenessChecks().latest('createdAt').first(),
      session.faceMatchChecks().latest('createdAt').first(),
      session.documentPortraits().latest('createdAt').first(),
    ])

    const media: string[] = []
    if (document?.frontImagePath) media.push('document_front')
    if (document?.backImagePath) media.push('document_back')
    if (portrait?.portraitImagePath) media.push('portrait')
    if (liveness?.selfieImagePath) media.push('selfie')
    if (liveness?.videoPath) media.push('video')

    return res.json({
      status: 'success',
      message: 'OK',
      code: 200,
      data: {
        id: session.id,
        project_id: session.projectId,
        user_reference: session.userReference ?? null,
        status: session.status,
        auto_decision: session.autoDecision ?? null,
        final_decision: session.finalDecision ?? null,
        decision_reason: session.decisionReason ?? null,
        risk_score: session.riskScore ?? null,
        assigned_to: session.assignedTo ?? null,
        reviewed_at: session.reviewedAt ?? null,
        reviewed_by: session.reviewedBy ?? null,
        metadata: session.metadata ?? null,
        expires_at: session.expiresAt,
        completed_at: session.completedAt ?? null,
        created_at: session.createdAt,
        document: document
          ? { country: document.country, document_type: document.documentType, quality_score: document.qualityScore }
          : null,
        ocr: ocr ? { fields: ocr.fields, confidence: ocr.confidence } : null,
        liveness: liveness
          ? { score: liveness.score, passed: liveness.passed, spoof_signals: liveness.spoofSignals ?? null }
          : null,
        face_match: faceMatch
          ? { similarity_score: faceMatch.similarityScore, confidence: faceMatch.confidence, passed: faceMatch.passed }
          : null,
        media,
      },
    })
  }

  /**
   * Stream a session media artifact (document/selfie image or liveness video).
   * Private storage is read server-side and streamed; the route is gated by
   * `sessions.view` so only authorized reviewers can fetch it.
   */
  async media({ req, res }: HttpContext) {
    const kind = param(req.params.kind) ?? ''
    const contentType = MEDIA_CONTENT_TYPE[kind]
    if (!contentType) return res.status(404).json({ status: 'error', message: 'Unknown media kind', code: 404 })

    const session = await this.scoped(req)
    const key = await this.mediaKey(session, kind)
    const bytes = await readObject(key)
    if (!bytes.length) return res.status(404).json({ status: 'error', message: 'Media not found', code: 404 })

    return res
      .status(200)
      .set('Content-Type', contentType)
      .set('Cache-Control', 'private, max-age=60')
      .send(Buffer.from(bytes))
  }

  /** Resolve the stored object key for a media kind, or null if absent. */
  private async mediaKey(session: VerificationSession, kind: string): Promise<string | null> {
    switch (kind) {
      case 'document_front':
        return (await session.documentCaptures().latest('createdAt').first())?.frontImagePath ?? null
      case 'document_back':
        return (await session.documentCaptures().latest('createdAt').first())?.backImagePath ?? null
      case 'portrait':
        return (await session.documentPortraits().latest('createdAt').first())?.portraitImagePath ?? null
      case 'selfie':
        return (await session.livenessChecks().latest('createdAt').first())?.selfieImagePath ?? null
      case 'video':
        return (await session.livenessChecks().latest('createdAt').first())?.videoPath ?? null
      default:
        return null
    }
  }

  /** Approve a session awaiting review. */
  async approve({ req }: HttpContext) {
    const data = await this.validate({ reason: ['nullable', 'string'] })
    const session = await this.scoped(req)
    await reviewService.approve(session, audit.actorFromRequest(req), data.reason ?? undefined)

    return this.session(session, 'Session approved')
  }

  /** Reject a session awaiting review. */
  async reject({ req }: HttpContext) {
    const data = await this.validate({ reason: ['nullable', 'string'] })
    const session = await this.scoped(req)
    await reviewService.reject(session, audit.actorFromRequest(req), data.reason ?? undefined)

    return this.session(session, 'Session rejected')
  }

  /** Send the session back for a document/selfie/full retry. */
  async requestRetry({ req }: HttpContext) {
    const data = await this.validate({
      kind: ['required', 'string', 'in:document,selfie,full'],
      reason: ['nullable', 'string'],
    })
    const session = await this.scoped(req)
    await reviewService.requestRetry(
      session,
      audit.actorFromRequest(req),
      data.kind as RetryKind,
      data.reason ?? undefined,
    )

    return this.session(session, 'Retry requested')
  }

  /** Assign the session to a reviewer. */
  async assign({ req }: HttpContext) {
    const data = await this.validate({ user_id: ['required', 'string'] })
    const session = await this.scoped(req)
    await reviewService.assign(session, audit.actorFromRequest(req), data.user_id)

    return this.session(session, 'Session assigned')
  }

  /** Flag the session as suspicious (no status change). */
  async markSuspicious({ req }: HttpContext) {
    const data = await this.validate({ reason: ['nullable', 'string'] })
    const session = await this.scoped(req)
    await reviewService.markSuspicious(session, audit.actorFromRequest(req), data.reason ?? undefined)

    return this.session(session, 'Session flagged as suspicious')
  }

  /** Attach a reviewer note (no status change). */
  async note({ req }: HttpContext) {
    const data = await this.validate({ note: ['required', 'string'] })
    const session = await this.scoped(req)
    await reviewService.addNote(session, audit.actorFromRequest(req), data.note)

    return this.session(session, 'Note added')
  }

  /** Resolve a session by id, scoped to the active organization (404 otherwise). */
  private scoped(req: HttpContext['req']) {
    return VerificationSession.where({ id: req.params.id, organizationId: req.organization!.id }).firstOrFail()
  }

  private session(session: VerificationSession, message: string) {
    return new VerificationSessionResource(session).additional({
      status: 'success',
      message,
      code: 200,
    })
  }
}
