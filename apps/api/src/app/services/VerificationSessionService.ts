import { RequestException } from '@arkstack/common'
import { SessionRules, StatusMachine } from '@arkyc/core'
import { Token } from '@arkyc/auth'
import { randomChallenges } from '@arkyc/liveness'
import { type FileLike, Storage } from '@arkstack/filesystem'
import type {
  CaptureModel,
  DocumentType,
  LivenessChallenge,
  LivenessMode,
  Metadata,
  VerificationStatus,
} from '@arkyc/types'
import { VerificationSession } from '@app/models/VerificationSession'
import { Project } from '@app/models/Project'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { sessionObjectKey } from 'src/support/storage'
import { transitionTo } from 'src/support/session-transition'
import { type ProviderSignals, livenessDriver } from './providers'
import { settings } from './GlobalSettingsService'
import { BiometricJob, OcrJob } from '@app/jobs'

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
  async create(
    scope: ProjectScope,
    input: { userReference?: string | null; metadata?: Metadata | null },
  ): Promise<{ session: VerificationSession; clientToken: string }> {
    const { token, tokenHash } = Token.createPair()
    // Resolve the offered capture model now and issue an active-liveness
    // challenge sequence up front when it applies, so the widget bootstrap can
    // surface them and submissions are validated against a fixed order.
    const captureModel = await this.resolveCaptureModel(scope.project_id)
    const livenessChallenges = this.offersActiveLiveness(captureModel) ? randomChallenges(3) : null

    const session = await VerificationSession.create({
      tenantId: scope.tenant_id,
      projectId: scope.project_id,
      userReference: input.userReference ?? null,
      status: 'pending',
      clientTokenHash: tokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      metadata: input.metadata ?? null,
      captureModel,
      livenessChallenges,
    })

    return { session, clientToken: token }
  }

  /** The capture model for a project: its own override, else the global default. */
  private async resolveCaptureModel(projectId: string): Promise<CaptureModel> {
    const project = await Project.where({ id: projectId }).first()
    const override = project?.settings?.capture_model
    if (override) return override

    return (await settings.current()).capture.model
  }

  /** Whether a capture model offers the active-liveness flow. */
  private offersActiveLiveness(model: CaptureModel): boolean {
    return model === 'active' || model === 'both'
  }

  /** Move a freshly-opened session to `started` when the widget first loads. */
  async start(session: VerificationSession): Promise<VerificationSession> {
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
  async submitDocument(
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

    if (side === 'front' && session.status === 'started') {
      await this.transition(session, 'document_submitted')
    }

    // Run OCR once every readable side is captured: at the back for two-sided
    // documents (the MRZ may be printed there), otherwise at the front. OCR reads
    // both stored sides and parses the combined text.
    const twoSided = capture.documentType != null && capture.documentType !== 'passport'
    const ocrReady = side === 'back' || (side === 'front' && !twoSided)
    if (ocrReady) {
      await OcrJob.dispatch(session.id, {
        ocrConfidence: input.signals?.ocrConfidence,
        expired: input.signals?.expired,
      })
    }

    return capture
  }

  /** Persist a liveness check (passive selfie or active challenge video). */
  async submitLiveness(
    session: VerificationSession,
    input: {
      selfie?: FileLike
      video?: FileLike
      mode?: LivenessMode
      performedChallenges?: LivenessChallenge[]
      signals?: ProviderSignals
    },
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

    // Only store a selfie when one was actually captured (passive selfie step, or
    // an active-liveness frame). Otherwise leave it null — no phantom placeholder.
    let selfiePath: string | null = null
    if (input.selfie) {
      selfiePath = sessionObjectKey(session, 'liveness/selfie.jpg')
      await Storage.disk().put(selfiePath, input.selfie, { visibility: 'private' })
    }

    let videoPath: string | null = null
    if (input.video) {
      videoPath = sessionObjectKey(session, 'liveness/video.webm')
      await Storage.disk().put(videoPath, input.video, { visibility: 'private' })
    }

    const result = await livenessDriver.check({
      selfie: input.selfie?.buffer ?? EMPTY_IMAGE,
      video: input.video?.buffer ?? null,
      mode: input.mode ?? 'passive',
      challenges: session.livenessChallenges ?? undefined,
      performedChallenges: input.performedChallenges,
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
      videoPath,
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
  async complete(session: VerificationSession, input: { signals?: ProviderSignals }): Promise<VerificationSession> {
    await this.ensureMutable(session)

    const capture = await DocumentCapture.where({ sessionId: session.id }).first()
    const liveness = await LivenessCheck.where({ sessionId: session.id }).first()
    RequestException.assertFound(capture, 'No document has been submitted', 409)
    RequestException.assertFound(liveness, 'No liveness check has been submitted', 409)

    await this.transition(session, 'processing')
    await BiometricJob.dispatch(session.id, {
      faceSimilarity: input.signals?.faceSimilarity,
      faceMatchPassed: input.signals?.faceMatchPassed,
    })

    return session
  }

  /** Cancel a non-terminal session. */
  async cancel(session: VerificationSession): Promise<VerificationSession> {
    await this.ensureMutable(session)
    await this.transition(session, 'cancelled')

    return session
  }

  /**
   * Lazily transition a past-its-TTL session to `expired` (no throw). Lets a
   * reader (e.g. the public `show`) observe expiry without a background job.
   */
  async refresh(session: VerificationSession): Promise<VerificationSession> {
    if (SessionRules.shouldExpire(session.status, session.expiresAt, new Date())) {
      await this.transition(session, 'expired')
    }

    return session
  }

  /** Lazily expire, then reject mutations on a session that has ended. */
  private async ensureMutable(session: VerificationSession): Promise<void> {
    await this.refresh(session)
    RequestException.abortIf(
      StatusMachine.isTerminal(session.status),
      `Session is ${session.status} and can no longer be modified`,
      409,
    )
  }

  /** Apply and persist a status change (validated) and fan out webhooks. */
  private async transition(session: VerificationSession, to: VerificationStatus): Promise<void> {
    await transitionTo(session, to)
  }
}

/** Shared singleton — the service holds no per-request state. */
export const sessionService = new VerificationSessionService()
