import type { DocumentType, LivenessChallenge, LivenessMode } from '@arkyc/types'

import { BaseController } from '@controllers/BaseController'
import ClientSessionResource, { type ClientRealtime } from '@app/http/resources/ClientSessionResource'
import type { FileLike } from '@arkstack/filesystem'
import { HttpContext } from 'clear-router/types/express'
import { Project } from '@app/models/Project'
import type { ProviderSignals } from '@app/services/providers'
import { RequestException } from '@arkstack/common'
import { parseRealtimeChannel, realtimeChannels } from '@arkyc/types'
import { realtime } from '@app/services/RealtimeService'
import { sessionService } from '@app/services/VerificationSessionService'

const DOCUMENT_TYPES = 'passport,id_card,drivers_license,residence_permit'

/**
 * Client/Widget API (short-lived client token). Drives a single session through
 * document capture, liveness, and completion. `req.verificationSession` is
 * resolved by `clientTokenAuth`.
 *
 * Images are uploaded as `multipart/form-data`: the `image` (document) / `selfie`
 * (liveness) fields are validated as files and consumed directly by Arkstack
 * `Storage`. The optional signal hints (`quality_score`, `liveness_score`,
 * `face_similarity`, …) steer the `mock` provider drivers and are ignored by
 * real drivers.
 */
export default class ClientSessionController extends BaseController {
  /** Return the current session, marking it `started` on first load. */
  async session({ req }: HttpContext) {
    const session = await sessionService.start(req.verificationSession!)
    const project = await Project.where({ id: session.projectId }).first()
    const handoff = project?.settings?.handoff
    const frontendUrl = String(req.headers.origin ?? config('app.frontend_url') ?? '').replace(/\/$/, '')

    return new ClientSessionResource(
      session,
      {
        enabled: !!handoff?.enabled,
        allow_desktop: handoff?.allow_desktop !== false,
        url: `${frontendUrl}/verify`,
      },
      await this.realtimeConfig(session.id),
    )
      .additional({
        status: 'success',
        message: 'OK',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Realtime connection info scoped to this one session: the active transport's
   * public params plus the session's own private channel. For firebase, mints a
   * per-session custom token so the widget can read only this session's events.
   */
  private async realtimeConfig(sessionId: string): Promise<ClientRealtime> {
    const config = await realtime.clientConfig()
    const channel = realtimeChannels.session(sessionId)
    let token: string | null = null
    if (config.transport === 'firebase') {
      token = await realtime.mintClientToken(sessionId, { session: sessionId })
    }

    return { ...config, channel, token }
  }

  /**
   * Pusher channel-auth for the widget's client token. Unlike the dashboard
   * authorizer, a client token may sign ONLY its own session's private channel —
   * never a tenant/project channel. Returns the raw Pusher `{ auth }` object.
   */
  async realtimeAuth({ req, res }: HttpContext) {
    const session = req.verificationSession!
    const socketId = String((this.body?.socket_id as string) ?? '')
    const channel = String((this.body?.channel_name as string) ?? '')
    RequestException.abortIf(!socketId || !channel, 'Missing socket_id/channel_name', 422)

    const scope = parseRealtimeChannel(channel)
    RequestException.abortIf(
      !scope || scope.kind !== 'session' || scope.sessionId !== session.id,
      'Forbidden channel',
      403,
    )

    const signed = await realtime.authorizeChannel(socketId, channel)
    RequestException.assertFound(signed, 'Channel auth unavailable for this transport', 409)

    res.status(200).json(signed)
  }

  /** Submit the document front image (runs OCR + portrait extraction). */
  async documentFront({ req }: HttpContext) {
    const data = await this.validate({
      country: ['nullable', 'string', 'max:3'],
      document_type: ['nullable', 'string', `in:${DOCUMENT_TYPES}`],
      image: ['nullable', 'file', 'image', 'max:10240'],
      quality_score: ['nullable', 'numeric', 'between:0,1'],
      ocr_confidence: ['nullable', 'numeric', 'between:0,1'],
      expired: ['nullable', 'boolean'],
    })

    await sessionService.submitDocument(req.verificationSession!, 'front', {
      country: data.country ?? null,
      documentType: (data.document_type as DocumentType) ?? null,
      image: data.image as FileLike | undefined,
      signals: this.signals(data),
    })

    return new ClientSessionResource(req.verificationSession!)
      .additional({
        status: 'success',
        message: 'Document front received',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /** Submit the document back image. */
  async documentBack({ req }: HttpContext) {
    const data = await this.validate({
      country: ['nullable', 'string', 'max:3'],
      document_type: ['nullable', 'string', `in:${DOCUMENT_TYPES}`],
      image: ['nullable', 'file', 'image', 'max:10240'],
    })

    await sessionService.submitDocument(req.verificationSession!, 'back', {
      country: data.country ?? null,
      documentType: (data.document_type as DocumentType) ?? null,
      image: data.image as FileLike | undefined,
    })

    return new ClientSessionResource(req.verificationSession!)
      .additional({
        status: 'success',
        message: 'Document back received',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /** Submit the liveness check — passive (selfie) or active (challenge video). */
  async liveness({ req }: HttpContext) {
    const data = await this.validate({
      selfie: ['nullable', 'file', 'image', 'max:10240'],
      video: ['nullable', 'file', 'max:51200'],
      mode: ['nullable', 'string', 'in:passive,active'],
      // JSON-encoded array of the challenges the widget performed (active mode).
      challenges: ['nullable', 'string'],
      liveness_score: ['nullable', 'numeric', 'between:0,1'],
      liveness_passed: ['nullable', 'boolean'],
      multiple_faces: ['nullable', 'boolean'],
    })

    await sessionService.submitLiveness(req.verificationSession!, {
      selfie: data.selfie as FileLike | undefined,
      video: data.video as FileLike | undefined,
      mode: (data.mode as LivenessMode) ?? undefined,
      performedChallenges: this.parseChallenges(data.challenges as string | undefined),
      signals: this.signals(data),
    })

    return new ClientSessionResource(req.verificationSession!)
      .additional({
        status: 'success',
        message: 'Liveness check received',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /** Finalise the session — runs the decision engine and lands a verdict. */
  async complete({ req }: HttpContext) {
    const data = await this.validate({
      face_similarity: ['nullable', 'numeric', 'between:0,1'],
      face_match_passed: ['nullable', 'boolean'],
    })

    const session = await sessionService.complete(req.verificationSession!, {
      signals: this.signals(data),
    })

    return new ClientSessionResource(session)
      .additional({
        status: 'success',
        message: 'Verification complete',
        code: 202,
      })
      .response()
      .setStatusCode(202)
  }

  /** Parse the JSON-encoded performed-challenge array, ignoring malformed input. */
  private parseChallenges(raw: string | undefined): LivenessChallenge[] | undefined {
    if (!raw) return undefined
    try {
      const parsed = JSON.parse(raw)

      return Array.isArray(parsed) ? (parsed as LivenessChallenge[]) : undefined
    } catch {
      return undefined
    }
  }

  /** Map validated body fields to provider signal hints. */
  private signals(data: Record<string, unknown>): ProviderSignals {
    return {
      qualityScore: data.quality_score as number | undefined,
      ocrConfidence: data.ocr_confidence as number | undefined,
      expired: data.expired as boolean | undefined,
      livenessScore: data.liveness_score as number | undefined,
      livenessPassed: data.liveness_passed as boolean | undefined,
      multipleFaces: data.multiple_faces as boolean | undefined,
      faceSimilarity: data.face_similarity as number | undefined,
      faceMatchPassed: data.face_match_passed as boolean | undefined,
    }
  }
}
