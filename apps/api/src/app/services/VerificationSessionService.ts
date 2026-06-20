import { RequestException } from '@arkstack/common'
import {
  type DecisionInput,
  assertTransition,
  decideVerification,
  isDocumentExpired,
  isTerminalStatus,
  shouldExpireSession,
} from '@arkyc/core'
import { createTokenPair } from '@arkyc/auth'
import type { DocumentType, Metadata, VerificationStatus } from '@arkyc/types'
import { VerificationSession } from '@app/models/VerificationSession'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { OcrResult } from '@app/models/OcrResult'
import { DocumentPortrait } from '@app/models/DocumentPortrait'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { FaceMatchCheck } from '@app/models/FaceMatchCheck'
import { Project } from '@app/models/Project'
import {
  type ProviderSignals,
  faceMatchDriver,
  livenessDriver,
  ocrDriver,
  storage,
} from './providers'

/** A verification session's lifetime — also bounds its client token. */
const SESSION_TTL_MS = 15 * 60 * 1000

/** Maximum liveness/selfie attempts before a session is locked out. */
const MAX_LIVENESS_ATTEMPTS = 3

/** Confidence reported for the (mock) portrait extraction off the document. */
const PORTRAIT_DETECTION_CONFIDENCE = 0.95

/** Empty payload stored when a step carries no real image bytes (mock flow). */
const EMPTY_IMAGE = new Uint8Array(0)

/** The integrating backend's resolved key context (`req.projectContext`). */
interface ProjectScope {
  tenant_id: string
  project_id: string
}

const objectPath = (s: VerificationSession, leaf: string): string =>
  `tenants/${s.tenantId}/projects/${s.projectId}/sessions/${s.id}/${leaf}`

/**
 * Drives the verification session lifecycle for the public + client APIs. Each
 * step stores its image via the storage driver and runs the configured provider
 * driver (`@arkyc/ocr`, `@arkyc/liveness`, `@arkyc/face-match` — `mock` by
 * default); `complete` aggregates the persisted signals, runs the decision
 * engine, and lands a final decision.
 */
export class VerificationSessionService {
  /** Create a `pending` session and mint its one-time client token. */
  async create (
    scope: ProjectScope,
    input: { userReference?: string | null; metadata?: Metadata | null },
  ): Promise<{ session: VerificationSession; clientToken: string }> {
    const { token, tokenHash } = createTokenPair()
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
   * front capture then runs OCR + portrait extraction and advances the session
   * to `document_submitted`.
   */
  async submitDocument (
    session: VerificationSession,
    side: 'front' | 'back',
    input: {
      country?: string | null
      documentType?: DocumentType | null
      image?: Uint8Array
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

    const imagePath = objectPath(session, `documents/${side}.jpg`)
    const imageBytes = input.image ?? EMPTY_IMAGE
    await storage.putObject(imagePath, imageBytes, { contentType: 'image/jpeg' })

    if (input.country !== undefined) capture.country = input.country
    if (input.documentType !== undefined) capture.documentType = input.documentType
    if (side === 'front') capture.frontImagePath = imagePath
    else capture.backImagePath = imagePath

    if (side === 'front') {
      capture.qualityScore = clamp01(input.signals?.qualityScore ?? 0.9)
    }
    await capture.save()

    // The front side carries the readable data — run OCR + portrait off it.
    if (side === 'front') {
      const ocr = await ocrDriver.extract({
        image: imageBytes,
        documentType: input.documentType ?? null,
        country: input.country ?? null,
        hints: { confidence: input.signals?.ocrConfidence, expired: input.signals?.expired },
      })
      await OcrResult.create({
        tenantId: session.tenantId,
        projectId: session.projectId,
        sessionId: session.id,
        documentCaptureId: capture.id,
        fields: ocr.fields,
        confidence: ocr.confidence,
        rawResponse: ocr.raw,
      })

      // The extracted portrait is persisted to storage for the face-match step.
      const portraitPath = objectPath(session, 'documents/portrait.jpg')
      await storage.putObject(portraitPath, imageBytes, { contentType: 'image/jpeg' })
      await DocumentPortrait.create({
        tenantId: session.tenantId,
        projectId: session.projectId,
        sessionId: session.id,
        documentCaptureId: capture.id,
        portraitImagePath: portraitPath,
        detectionConfidence: PORTRAIT_DETECTION_CONFIDENCE,
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
    input: { selfie?: Uint8Array; signals?: ProviderSignals },
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

    const selfiePath = objectPath(session, 'liveness/selfie.jpg')
    const selfieBytes = input.selfie ?? EMPTY_IMAGE
    await storage.putObject(selfiePath, selfieBytes, { contentType: 'image/jpeg' })

    const result = await livenessDriver.check({
      selfie: selfieBytes,
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
   * Run face match, aggregate all persisted signals through the decision
   * engine, and land the session in a final decision.
   */
  async complete (
    session: VerificationSession,
    input: { signals?: ProviderSignals },
  ): Promise<VerificationSession> {
    await this.ensureMutable(session)

    const capture = await DocumentCapture.where({ sessionId: session.id }).first()
    const ocr = await OcrResult.where({ sessionId: session.id }).first()
    const liveness = await LivenessCheck.where({ sessionId: session.id }).first()
    RequestException.assertFound(capture, 'No document has been submitted', 409)
    RequestException.assertFound(ocr, 'No document has been submitted', 409)
    RequestException.assertFound(liveness, 'No liveness check has been submitted', 409)

    const portrait = await DocumentPortrait.where({ sessionId: session.id }).first()
    const faceMatch = await faceMatchDriver.compare({
      documentPortrait: await this.readObject(portrait?.portraitImagePath),
      selfie: await this.readObject(liveness.selfieImagePath),
      hints: {
        similarityScore: input.signals?.faceSimilarity,
        passed: input.signals?.faceMatchPassed,
      },
    })
    await FaceMatchCheck.create({
      tenantId: session.tenantId,
      projectId: session.projectId,
      sessionId: session.id,
      idPortraitImagePath: portrait?.portraitImagePath ?? null,
      selfieImagePath: liveness.selfieImagePath,
      similarityScore: faceMatch.similarityScore,
      confidence: faceMatch.confidence,
      passed: faceMatch.passed,
      provider: faceMatchDriver.name,
      rawResponse: faceMatch.raw,
    })

    await this.transition(session, 'processing')

    const decisionInput: DecisionInput = {
      document: {
        qualityScore: capture.qualityScore ?? 0,
        ocrConfidence: ocr.confidence,
        expired: isDocumentExpired(ocr.fields.expiryDate, new Date()),
      },
      liveness: {
        passed: liveness.passed,
        score: liveness.score,
        multipleFaces: liveness.spoofSignals?.multipleFaces ?? false,
      },
      faceMatch: {
        passed: faceMatch.passed,
        similarityScore: faceMatch.similarityScore,
      },
    }

    const project = await Project.where({ id: session.projectId }).first()
    const { decision, reason, riskScore } = decideVerification(
      decisionInput,
      project?.settings?.thresholds,
    )

    session.autoDecision = decision
    session.decisionReason = reason
    session.riskScore = riskScore
    // Auto outcomes are final; `requires_review` waits for a human (Phase 9).
    if (decision === 'approved' || decision === 'rejected') {
      session.finalDecision = decision
      session.completedAt = new Date()
    }
    await this.transition(session, decision)

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
    if (shouldExpireSession(session.status, session.expiresAt, new Date())) {
      await this.transition(session, 'expired')
    }
    return session
  }

  /** Lazily expire, then reject mutations on a session that has ended. */
  private async ensureMutable (session: VerificationSession): Promise<void> {
    await this.refresh(session)
    RequestException.abortIf(
      isTerminalStatus(session.status),
      `Session is ${session.status} and can no longer be modified`,
      409,
    )
  }

  /** Read stored bytes for an object, tolerating a missing path/object. */
  private async readObject (key: string | null | undefined): Promise<Uint8Array> {
    if (!key) return EMPTY_IMAGE
    try {
      return await storage.getObject(key)
    } catch {
      return EMPTY_IMAGE
    }
  }

  /** Apply and persist a status change, validating it against the state machine. */
  private async transition (
    session: VerificationSession,
    to: VerificationStatus,
  ): Promise<void> {
    session.status = assertTransition(session.status, to)
    await session.save()
  }
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** Shared singleton — the service holds no per-request state. */
export const sessionService = new VerificationSessionService()
