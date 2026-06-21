import { RequestException } from '@arkstack/common'
import { SessionRules, StatusMachine } from '@arkyc/core'
import { Token } from '@arkyc/auth'
import { type FileLike, Storage } from '@arkstack/filesystem'
import type { DocumentType, Metadata, VerificationStatus } from '@arkyc/types'
import { VerificationSession } from '@app/models/VerificationSession'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { sessionObjectKey } from 'src/support/storage'
import { transitionTo } from 'src/support/session-transition'
import { type ProviderSignals, livenessDriver } from './providers'
import { queue } from './Queue'

/** A verification session's lifetime — also bounds its client token. */
const SESSION_TTL_MS = 15 * 60 * 1000

/** Maximum liveness/selfie attempts before a session is locked out. */
const MAX_LIVENESS_ATTEMPTS = 3

/** Empty payload stored when a step carries no real image bytes (mock flow). */
const EMPTY_IMAGE = new Uint8Array(0)

/** The integrating backend's resolved key context (`req.projectContext`). */
interface ProjectScope {
  tenant_id: string
  project_id: string
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Drives the verification session lifecycle for the public + client APIs
 * (Phase 8 — async pipeline).
 *
 * Heavy work runs off the request path via the durable queue: a document submit
 * enqueues an `ocr` job (OCR + portrait), and `complete` enqueues a `biometric`
 * job (face match + decision), moving the session to `processing` until a worker
 * lands the final decision. Liveness stays inline — it's a cheap check and keeps
 * the per-session attempt limit simple.
 */
export class VerificationSessionService {
  /** Create a `pending` session and mint its one-time client token. */
  async create (
    scope: ProjectScope,
    input: { userReference?: string | null; metadata?: Metadata | null },
  ): Promise<{ session: VerificationSession; clientToken: string }> {
    const { token, tokenHash } = Token.createPair()
    const session = await VerificationSession.create({
      tenantId: scope.tenant_id,
      projectId: scope.project_id,
      userReference: input.userReference ?? null,
      status: 'pending',
      clientTokenHash: tokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      metadata: input.metadata ?? null,
    })

    return { session, clientToken: token }
  }

  /** Move a freshly-opened session to `started` when the widget first loads. */
  async start (session: VerificationSession): Promise<VerificationSession> {
    await this.refresh(session)
    if (session.status === 'pending') {
      await this.transition(session, 'started')
    }

    return session
  }

  /**
   * Persist a document side. The image is stored via the storage driver; the
   * front capture enqueues async OCR + portrait extraction and advances the
   * session to `document_submitted`.
   */
  async submitDocument (
    session: VerificationSession,
    side: 'front' | 'back',
    input: {
      country?: string | null
      documentType?: DocumentType | null
      image?: FileLike
      signals?: ProviderSignals
    },
  ): Promise<DocumentCapture> {
    await this.ensureMutable(session)

    const capture =
      (await DocumentCapture.where({ sessionId: session.id }).first()) ??
      (await DocumentCapture.create({
        tenantId: session.tenantId,
        projectId: session.projectId,
        sessionId: session.id,
      }))

    const imagePath = sessionObjectKey(session, `documents/${side}.jpg`)
    await Storage.disk().put(imagePath, input.image ?? EMPTY_IMAGE, { visibility: 'private' })

    if (input.country !== undefined) capture.country = input.country
    if (input.documentType !== undefined) capture.documentType = input.documentType
    if (side === 'front') capture.frontImagePath = imagePath
    else capture.backImagePath = imagePath

    if (side === 'front') {
      capture.qualityScore = clamp01(input.signals?.qualityScore ?? 0.9)
    }
    await capture.save()

    // The front side carries the readable data — OCR + portrait run async.
    if (side === 'front') {
      await queue.enqueue('ocr', {
        sessionId: session.id,
        hints: { ocrConfidence: input.signals?.ocrConfidence, expired: input.signals?.expired },
      })

      if (session.status === 'started') {
        await this.transition(session, 'document_submitted')
      }
    }

    return capture
  }

  /** Persist a liveness/selfie check and advance to `liveness_submitted`. */
  async submitLiveness (
    session: VerificationSession,
    input: { selfie?: FileLike; signals?: ProviderSignals },
  ): Promise<LivenessCheck> {
    await this.ensureMutable(session)
    RequestException.abortIf(
      session.status === 'pending' || session.status === 'started',
      'Submit a document before the liveness check',
      409,
    )

    const attempts = await LivenessCheck.where({ sessionId: session.id }).count()
    RequestException.abortIf(
      attempts >= MAX_LIVENESS_ATTEMPTS,
      `Maximum of ${MAX_LIVENESS_ATTEMPTS} liveness attempts reached`,
      429,
    )

    const selfiePath = sessionObjectKey(session, 'liveness/selfie.jpg')
    await Storage.disk().put(selfiePath, input.selfie ?? EMPTY_IMAGE, { visibility: 'private' })

    const result = await livenessDriver.check({
      selfie: input.selfie?.buffer ?? EMPTY_IMAGE,
      hints: {
        score: input.signals?.livenessScore,
        passed: input.signals?.livenessPassed,
        multipleFaces: input.signals?.multipleFaces,
      },
    })
    const check = await LivenessCheck.create({
      tenantId: session.tenantId,
      projectId: session.projectId,
      sessionId: session.id,
      selfieImagePath: selfiePath,
      score: result.score,
      passed: result.passed,
      spoofSignals: result.spoofSignals,
      provider: livenessDriver.name,
      rawResponse: result.raw,
    })

    if (session.status === 'document_submitted') {
      await this.transition(session, 'liveness_submitted')
    }

    return check
  }

  /**
   * Finalise: require a document + liveness, move to `processing`, and enqueue
   * the biometric job (face match + decision). A worker lands the final outcome.
   */
  async complete (
    session: VerificationSession,
    input: { signals?: ProviderSignals },
  ): Promise<VerificationSession> {
    await this.ensureMutable(session)

    const capture = await DocumentCapture.where({ sessionId: session.id }).first()
    const liveness = await LivenessCheck.where({ sessionId: session.id }).first()
    RequestException.assertFound(capture, 'No document has been submitted', 409)
    RequestException.assertFound(liveness, 'No liveness check has been submitted', 409)

    await this.transition(session, 'processing')
    await queue.enqueue('biometric', {
      sessionId: session.id,
      hints: {
        faceSimilarity: input.signals?.faceSimilarity,
        faceMatchPassed: input.signals?.faceMatchPassed,
      },
    })

    return session
  }

  /** Cancel a non-terminal session. */
  async cancel (session: VerificationSession): Promise<VerificationSession> {
    await this.ensureMutable(session)
    await this.transition(session, 'cancelled')

    return session
  }

  /**
   * Lazily transition a past-its-TTL session to `expired` (no throw). Lets a
   * reader (e.g. the public `show`) observe expiry without a background job.
   */
  async refresh (session: VerificationSession): Promise<VerificationSession> {
    if (SessionRules.shouldExpire(session.status, session.expiresAt, new Date())) {
      await this.transition(session, 'expired')
    }

    return session
  }

  /** Lazily expire, then reject mutations on a session that has ended. */
  private async ensureMutable (session: VerificationSession): Promise<void> {
    await this.refresh(session)
    RequestException.abortIf(
      StatusMachine.isTerminal(session.status),
      `Session is ${session.status} and can no longer be modified`,
      409,
    )
  }

  /** Apply and persist a status change (validated) and fan out webhooks. */
  private async transition (
    session: VerificationSession,
    to: VerificationStatus,
  ): Promise<void> {
    await transitionTo(session, to)
  }
}

/** Shared singleton — the service holds no per-request state. */
export const sessionService = new VerificationSessionService()
