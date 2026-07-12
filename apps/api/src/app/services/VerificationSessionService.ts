import { RequestException } from '@arkstack/common'
import { ApiException } from 'src/support/apiErrors'
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
  PostalAddress,
  VerificationStatus,
} from '@arkyc/types'
import { VerificationSession } from '@app/models/VerificationSession'
import { Project } from '@app/models/Project'
import { Workflow } from '@app/models/Workflow'
import { type WorkflowConfig, workflowAddressConfig, workflowEnables, workflowRunsOcr } from '@arkyc/types'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { AddressVerification } from '@app/models/AddressVerification'
import { sessionObjectKey } from 'src/support/storage'
import { transitionTo } from 'src/support/session-transition'
import { toArray } from 'src/support/collection'
import { type ProviderSignals, addressVerifier, livenessDriver } from './providers'
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
  organization_id: string
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
  /**
   * Create a `pending` session and mint its one-time client token.
   *
   * @param scope
   * @param input
   * @returns
   */
  async create(
    scope: ProjectScope,
    input: { userReference?: string | null; metadata?: Metadata | null; workflowId?: string | null },
  ): Promise<{ session: VerificationSession; clientToken: string }> {
    const { token, tokenHash } = Token.createPair()
    // Resolve and snapshot the workflow now so editing/deleting it never
    // disturbs this session. A null workflow runs the default pipeline.
    const workflow = await this.resolveWorkflow(scope.organization_id, input.workflowId ?? null)
    // Resolve the offered capture model now and issue an active-liveness
    // challenge sequence up front when it applies, so the widget bootstrap can
    // surface them and submissions are validated against a fixed order.
    const captureModel = await this.resolveCaptureModel(scope.project_id)
    const livenessChallenges =
      workflowEnables(workflow, 'liveness') && this.offersActiveLiveness(captureModel) ? randomChallenges(3) : null

    const session = await VerificationSession.create({
      organizationId: scope.organization_id,
      projectId: scope.project_id,
      userReference: input.userReference ?? null,
      status: 'pending',
      clientTokenHash: tokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      metadata: input.metadata ?? null,
      captureModel,
      livenessChallenges,
      workflowId: input.workflowId ?? null,
      workflow,
    })

    return { session, clientToken: token }
  }

  /**
   * Look up and snapshot an organization's workflow config; 422 if it doesn't belong to the org.
   *
   * @param organizationId
   * @param workflowId
   * @returns
   */
  private async resolveWorkflow(organizationId: string, workflowId: string | null): Promise<WorkflowConfig | null> {
    if (!workflowId) return null
    const workflow = await Workflow.where({ id: workflowId, organizationId }).first()
    if (!workflow) throw new ApiException('invalid_workflow')

    return { steps: workflow.steps, options: workflow.options }
  }

  /**
   * The capture model for a project: its own override, else the global default.
   *
   * @param projectId
   * @returns
   */
  private async resolveCaptureModel(projectId: string): Promise<CaptureModel> {
    const project = await Project.where({ id: projectId }).first()
    const override = project?.settings?.capture_model
    if (override) return override

    return (await settings.current()).capture.model
  }

  /**
   * Whether a capture model offers the active-liveness flow.
   *
   * @param model
   * @returns
   */
  private offersActiveLiveness(model: CaptureModel): boolean {
    return model === 'active' || model === 'both'
  }

  /**
   * Move a freshly-opened session to `started` when the widget first loads.
   *
   * @param session
   * @returns
   */
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
   *
   * @param session
   * @param side
   * @param input
   * @returns
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
        organizationId: session.organizationId,
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
    // both stored sides and parses the combined text. A workflow can skip OCR
    // (capture-only) — then the image is stored but no fields are extracted.
    const twoSided = capture.documentType != null && capture.documentType !== 'passport'
    const ocrReady = side === 'back' || (side === 'front' && !twoSided)
    if (ocrReady && workflowRunsOcr(session.workflow)) {
      await OcrJob.dispatch(session.id, {
        ocrConfidence: input.signals?.ocrConfidence,
        expired: input.signals?.expired,
      })
    }

    return capture
  }

  /**
   * Persist a liveness check (passive selfie or active challenge video).
   *
   * @param session
   * @param input
   * @returns
   */
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
    // Liveness normally follows the document, but a workflow can run it first
    // (or with document disabled) — in which case it may lead from `started`.
    const livenessLeads = this.livenessLeads(session)
    RequestException.abortIf(
      !livenessLeads && (session.status === 'pending' || session.status === 'started'),
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
      organizationId: session.organizationId,
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

    if (session.status === 'document_submitted' || session.status === 'started') {
      await this.transition(session, 'liveness_submitted')
    }

    return check
  }

  /**
   * Whether liveness runs before the document for a session
   * (document disabled or ordered later).
   *
   * @param session
   * @returns
   */
  private livenessLeads(session: VerificationSession): boolean {
    const workflow = session.workflow
    if (!workflow) return false

    const documentIndex = workflow.steps.findIndex((step) => step.key === 'document' && step.enabled)
    if (documentIndex < 0) return true // document disabled — liveness leads

    const livenessIndex = workflow.steps.findIndex((step) => step.key === 'liveness' && step.enabled)

    return livenessIndex >= 0 && livenessIndex < documentIndex
  }

  /**
   * Persist address verification (opt-in stage). Runs the workflow's configured
   * methods inline through the address verifier and stores the result. Idempotent
   * inputs (claimed address, optional proof-of-address image, device coords) are
   * stored alongside the verdict so a reviewer can see what was checked.
   *
   * @param session
   * @param input
   * @returns
   */
  async submitAddress(
    session: VerificationSession,
    input: {
      claimed?: PostalAddress | null
      poaImage?: FileLike
      latitude?: number | null
      longitude?: number | null
      countryHint?: string | null
      signals?: ProviderSignals
    },
  ): Promise<AddressVerification> {
    await this.ensureMutable(session)

    const config = workflowAddressConfig(session.workflow)
    RequestException.abortIf(!config, 'Address verification is not enabled for this session', 409)

    let poaPath: string | null = null
    if (input.poaImage) {
      poaPath = sessionObjectKey(session, 'address/proof.jpg')
      await Storage.disk().put(poaPath, input.poaImage, { visibility: 'private' })
    }

    const coords =
      input.latitude != null && input.longitude != null
        ? { latitude: input.latitude, longitude: input.longitude }
        : null

    const result = await addressVerifier.verify({
      methods: config!.methods,
      claimed: input.claimed ?? null,
      poaImage: input.poaImage?.buffer ?? null,
      coords,
      countryHint: input.countryHint ?? null,
      hints: { passed: input.signals?.addressPassed, score: input.signals?.addressScore },
    })

    const verification = await AddressVerification.create({
      organizationId: session.organizationId,
      projectId: session.projectId,
      sessionId: session.id,
      claimedAddress: input.claimed ?? null,
      documentImagePath: poaPath,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      passed: result.passed,
      score: result.score,
      methods: result.methods,
      provider: addressVerifier.name,
      rawResponse: result.raw,
    })

    if (session.status === 'started' || session.status === 'document_submitted') {
      await this.transition(session, 'address_submitted')
    }

    return verification
  }

  /**
   * Finalise: require a document + liveness, move to `processing`, and enqueue
   * the biometric job (face match + decision). A worker lands the final outcome.
   *
   * @param session
   * @param input
   * @returns
   */
  async complete(session: VerificationSession, input: { signals?: ProviderSignals }): Promise<VerificationSession> {
    await this.ensureMutable(session)

    // Only require the stages the workflow actually runs.
    if (workflowEnables(session.workflow, 'document')) {
      const capture = await DocumentCapture.where({ sessionId: session.id }).first()
      RequestException.assertFound(capture, 'No document has been submitted', 409)
    }
    if (workflowEnables(session.workflow, 'address')) {
      const address = await AddressVerification.where({ sessionId: session.id }).first()
      RequestException.assertFound(address, 'Address verification has not been submitted', 409)
    }
    if (workflowEnables(session.workflow, 'liveness')) {
      const liveness = await LivenessCheck.where({ sessionId: session.id }).first()
      RequestException.assertFound(liveness, 'No liveness check has been submitted', 409)
    }

    await this.transition(session, 'processing')
    await BiometricJob.dispatch(session.id, {
      faceSimilarity: input.signals?.faceSimilarity,
      faceMatchPassed: input.signals?.faceMatchPassed,
    })

    return session
  }

  /**
   * Cancel a non-terminal session.
   *
   * @param session
   * @returns
   */
  async cancel(session: VerificationSession): Promise<VerificationSession> {
    await this.ensureMutable(session)
    await this.transition(session, 'cancelled')

    return session
  }

  /**
   * Lazily transition a past-its-TTL session to `expired` (no throw). Lets a
   * reader (e.g. the public `show`) observe expiry without a background job.
   *
   * @param session
   * @returns
   */
  async refresh(session: VerificationSession): Promise<VerificationSession> {
    if (SessionRules.shouldExpire(session.status, session.expiresAt, new Date())) {
      await this.transition(session, 'expired')
    }

    return session
  }

  /**
   * Expire every past-its-TTL, non-terminal session that no reader has touched
   * (the lazy `refresh` only fires on access, so untouched sessions linger). Each
   * runs through the shared `transition` choke point, so integrators still get the
   * `verification.expired` webhook + realtime broadcast. Batched to bound the work
   * per run; the scheduler (`routes/console.ts`) calls this on a fixed cadence.
   *
   * @param limit  Maximum sessions to expire in one invocation.
   * @returns The number of sessions expired.
   */
  async sweepExpired(limit = 500): Promise<number> {
    const due = toArray(
      await VerificationSession.query()
        .whereNotIn('status', [...StatusMachine.TERMINAL])
        .wherePast('expiresAt')
        .limit(limit)
        .get(),
    )

    let expired = 0
    for (const session of due) {
      // Re-check against the machine: a concurrent read may have already expired it.
      if (!SessionRules.shouldExpire(session.status, session.expiresAt, new Date())) continue
      try {
        await this.transition(session, 'expired')
        expired += 1
      } catch {
        // One session failing (e.g. a concurrent write) shouldn't abort the batch.
      }
    }

    return expired
  }

  /**
   * Lazily expire, then reject mutations on a session that has ended.
   *
   * @param session
   */
  private async ensureMutable(session: VerificationSession): Promise<void> {
    await this.refresh(session)
    RequestException.abortIf(
      StatusMachine.isTerminal(session.status),
      `Session is ${session.status} and can no longer be modified`,
      409,
    )
  }

  /**
   * Apply and persist a status change (validated) and fan out webhooks.
   *
   * @param session
   * @param to
   */
  private async transition(session: VerificationSession, to: VerificationStatus): Promise<void> {
    await transitionTo(session, to)
  }
}

/**
 * Shared singleton — the service holds no per-request state.
 */
export const sessionService = new VerificationSessionService()
