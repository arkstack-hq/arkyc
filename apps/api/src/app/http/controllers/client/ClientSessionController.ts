import type { DocumentType, LivenessChallenge, LivenessMode, PostalAddress } from '@arkyc/types'

import { BaseController } from '@controllers/BaseController'
import ClientSessionResource, { type ClientRealtime } from '@app/http/resources/ClientSessionResource'
import type { FileLike } from '@arkstack/filesystem'
import { HttpContext } from 'clear-router/types/express'
import { Project } from '@app/models/Project'
import type { ProviderSignals } from '@app/services/providers'
import { Broadcast } from '@arkstack/notifications'
import { realtimeChannels } from '@arkyc/types'
import { resolveBranding } from 'src/support/storage'
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
    const frontendUrl = String(config('app.website_url', config('app.frontend_url', ''))).replace(/\/$/, '')

    return new ClientSessionResource(
      session,
      {
        enabled: !!handoff?.enabled,
        allow_desktop: handoff?.allow_desktop !== false,
        url: `${frontendUrl}/verify`,
      },
      await this.realtimeConfig(session.id),
      project ? await resolveBranding(project.branding) : null,
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
   * The active transport's public settings plus this session's own channel.
   *
   * @param sessionId
   * @returns
   */
  private async realtimeConfig(sessionId: string): Promise<ClientRealtime> {
    return { ...Broadcast.clientConfig(), channel: realtimeChannels.session(sessionId) }
  }

  /**
   * Channel auth for the widget's client token. The session is the subject, so
   * the channel rules only let it join its own session channel.
   *
   * @param ctx
   */
  async realtimeAuth({ req, res }: HttpContext) {
    const session = req.verificationSession!
    const request = {
      socket_id: this.body?.socket_id as string | undefined,
      channel_name: this.body?.channel_name as string | undefined,
    }

    const result = await Broadcast.handleAuth(session, request, { uid: `session-${session.id}` })

    res.status(200).json(result ?? {})
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

  /**
   * Submit address verification (opt-in stage). Carries the user's claimed
   * address fields, an optional proof-of-address image (`poa`), and optional
   * device coordinates — the workflow's configured methods decide which are used.
   *
   * @param param0
   * @returns
   */
  async address({ req }: HttpContext) {
    const data = await this.validate({
      line1: ['nullable', 'string', 'max:255'],
      line2: ['nullable', 'string', 'max:255'],
      city: ['nullable', 'string', 'max:120'],
      region: ['nullable', 'string', 'max:120'],
      postal_code: ['nullable', 'string', 'max:32'],
      country: ['nullable', 'string', 'max:2'],
      poa: ['nullable', 'file', 'image', 'max:10240'],
      latitude: ['nullable', 'numeric', 'between:-90,90'],
      longitude: ['nullable', 'numeric', 'between:-180,180'],
      address_score: ['nullable', 'numeric', 'between:0,1'],
      address_passed: ['nullable', 'boolean'],
    })

    const claimed = this.claimedAddress(data)
    await sessionService.submitAddress(req.verificationSession!, {
      claimed,
      poaImage: data.poa as FileLike | undefined,
      latitude: data.latitude as number | undefined,
      longitude: data.longitude as number | undefined,
      countryHint: (data.country as string | undefined) ?? claimed?.country ?? null,
      signals: this.signals(data),
    })

    return new ClientSessionResource(req.verificationSession!)
      .additional({
        status: 'success',
        message: 'Address received',
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

  /** Build a claimed {@link PostalAddress} from the form fields, or null when blank. */
  private claimedAddress(data: Record<string, unknown>): PostalAddress | null {
    const address: PostalAddress = {
      line1: (data.line1 as string | undefined) || undefined,
      line2: (data.line2 as string | undefined) || undefined,
      city: (data.city as string | undefined) || undefined,
      region: (data.region as string | undefined) || undefined,
      postalCode: (data.postal_code as string | undefined) || undefined,
      country: (data.country as string | undefined) || undefined,
    }

    return Object.values(address).some(Boolean) ? address : null
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
      addressScore: data.address_score as number | undefined,
      addressPassed: data.address_passed as boolean | undefined,
    }
  }
}
