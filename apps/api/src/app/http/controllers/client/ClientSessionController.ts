import { BaseController } from '@controllers/BaseController'
import ClientSessionResource from '@app/http/resources/ClientSessionResource'
import type { DocumentType } from '@arkyc/types'
import { HttpContext } from 'clear-router/types/express'
import type { ProviderSignals } from '@app/services/providers'
import type { VerificationSession } from '@app/models/VerificationSession'
import { sessionService } from '@app/services/VerificationSessionService'

const DOCUMENT_TYPES = 'passport,id_card,drivers_license,residence_permit'

/**
 * Client/Widget API (short-lived client token). Drives a single session through
 * document capture, liveness, and completion. `req.verificationSession` is
 * resolved by `clientTokenAuth`.
 *
 * Image bytes are accepted as an optional base64 `image` (document) / `selfie`
 * (liveness) body field and stored via Arkstack `Storage`. The optional signal
 * hints (`quality_score`, `liveness_score`, `face_similarity`, …) steer the
 * `mock` provider drivers and are ignored by real drivers.
 */
export default class ClientSessionController extends BaseController {
  /** Return the current session, marking it `started` on first load. */
  async session ({ req }: HttpContext) {
    const session = await sessionService.start(req.verificationSession!)

    return this.ok(session, 'OK')
  }

  /** Submit the document front image (runs OCR + portrait extraction). */
  async documentFront ({ req }: HttpContext) {
    const data = await this.validate({
      country: ['nullable', 'string', 'max:3'],
      document_type: ['nullable', 'string', `in:${DOCUMENT_TYPES}`],
      image: ['nullable', 'string'],
      quality_score: ['nullable', 'numeric', 'between:0,1'],
      ocr_confidence: ['nullable', 'numeric', 'between:0,1'],
      expired: ['nullable', 'boolean'],
    })

    await sessionService.submitDocument(req.verificationSession!, 'front', {
      country: data.country ?? null,
      documentType: (data.document_type as DocumentType) ?? null,
      image: this.decodeImage(data.image),
      signals: this.signals(data),
    })

    return this.ok(req.verificationSession!, 'Document front received')
  }

  /** Submit the document back image. */
  async documentBack ({ req }: HttpContext) {
    const data = await this.validate({
      country: ['nullable', 'string', 'max:3'],
      document_type: ['nullable', 'string', `in:${DOCUMENT_TYPES}`],
      image: ['nullable', 'string'],
    })

    await sessionService.submitDocument(req.verificationSession!, 'back', {
      country: data.country ?? null,
      documentType: (data.document_type as DocumentType) ?? null,
      image: this.decodeImage(data.image),
    })

    return this.ok(req.verificationSession!, 'Document back received')
  }

  /** Submit the liveness/selfie check. */
  async liveness ({ req }: HttpContext) {
    const data = await this.validate({
      selfie: ['nullable', 'string'],
      liveness_score: ['nullable', 'numeric', 'between:0,1'],
      liveness_passed: ['nullable', 'boolean'],
      multiple_faces: ['nullable', 'boolean'],
    })

    await sessionService.submitLiveness(req.verificationSession!, {
      selfie: this.decodeImage(data.selfie),
      signals: this.signals(data),
    })

    return this.ok(req.verificationSession!, 'Liveness check received')
  }

  /** Finalise the session — runs the decision engine and lands a verdict. */
  async complete ({ req }: HttpContext) {
    const data = await this.validate({
      face_similarity: ['nullable', 'numeric', 'between:0,1'],
      face_match_passed: ['nullable', 'boolean'],
    })

    const session = await sessionService.complete(req.verificationSession!, {
      signals: this.signals(data),
    })

    return this.ok(session, 'Verification complete')
  }

  /** Map validated body fields to provider signal hints. */
  private signals (data: Record<string, unknown>): ProviderSignals {
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

  /** Decode a validated, optional base64 image field. */
  private decodeImage (value: unknown): Uint8Array | undefined {
    return typeof value === 'string' && value.length > 0 ? Buffer.from(value, 'base64') : undefined
  }

  private ok (session: VerificationSession, message: string) {
    return new ClientSessionResource(session)
      .additional({
        status: 'success',
        message,
        code: 200,
      })
  }
}
