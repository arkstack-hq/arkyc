import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import type { DocumentType } from '@arkyc/types'
import type { MockSignals } from '@app/services/providers/mock-providers'
import type { VerificationSession } from '@app/models/VerificationSession'
import ClientSessionResource from '@app/http/resources/ClientSessionResource'
import { sessionService } from '@app/services/VerificationSessionService'

/**
 * Client/Widget API (short-lived client token). Drives a single session through
 * document capture, liveness, and completion. `req.verificationSession` is
 * resolved by `clientTokenAuth`.
 *
 * The optional mock-signal hints in request bodies (`quality_score`,
 * `liveness_score`, `face_similarity`, …) are a Phase 6 affordance for steering
 * the inline mock providers; real captures replace them in Phase 7.
 */
export default class ClientSessionController extends BaseController {
  /** Return the current session, marking it `started` on first load. */
  async session ({ req }: HttpContext) {
    const session = await sessionService.start(req.verificationSession!)

    return this.ok(session, 'OK')
  }

  /** Submit the document front image (runs OCR + portrait extraction). */
  async documentFront ({ req }: HttpContext) {
    await sessionService.submitDocument(req.verificationSession!, 'front', {
      country: this.body.country ?? null,
      documentType: (this.body.document_type as DocumentType) ?? null,
      signals: this.signals(),
    })

    return this.ok(req.verificationSession!, 'Document front received')
  }

  /** Submit the document back image. */
  async documentBack ({ req }: HttpContext) {
    await sessionService.submitDocument(req.verificationSession!, 'back', {
      country: this.body.country ?? null,
      documentType: (this.body.document_type as DocumentType) ?? null,
      signals: this.signals(),
    })

    return this.ok(req.verificationSession!, 'Document back received')
  }

  /** Submit the liveness/selfie check. */
  async liveness ({ req }: HttpContext) {
    await sessionService.submitLiveness(req.verificationSession!, { signals: this.signals() })

    return this.ok(req.verificationSession!, 'Liveness check received')
  }

  /** Finalise the session — runs the decision engine and lands a verdict. */
  async complete ({ req }: HttpContext) {
    const session = await sessionService.complete(req.verificationSession!, {
      signals: this.signals(),
    })

    return this.ok(session, 'Verification complete')
  }

  /** Pull the optional mock-provider hints from the request body. */
  private signals (): MockSignals {
    const b = this.body

    return {
      qualityScore: b.quality_score,
      ocrConfidence: b.ocr_confidence,
      expired: b.expired,
      livenessScore: b.liveness_score,
      livenessPassed: b.liveness_passed,
      multipleFaces: b.multiple_faces,
      faceSimilarity: b.face_similarity,
      faceMatchPassed: b.face_match_passed,
    }
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
