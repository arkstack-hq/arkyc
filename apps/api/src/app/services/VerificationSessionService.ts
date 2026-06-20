import { RequestException } from '@arkstack/common'
import {
  type DecisionInput,
  assertTransition,
  decideVerification,
  isDocumentExpired,
  isTerminalStatus,
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
  type MockSignals,
  mockFaceMatch,
  mockLiveness,
  mockOcr,
  mockPortrait,
} from './providers/mock-providers'

/** A verification session's lifetime — also bounds its client token. */
const SESSION_TTL_MS = 15 * 60 * 1000

/** The integrating backend's resolved key context (`req.projectContext`). */
interface ProjectScope {
  tenant_id: string
  project_id: string
}

const objectPath = (s: VerificationSession, leaf: string): string =>
  `tenants/${s.tenantId}/projects/${s.projectId}/sessions/${s.id}/${leaf}`

/**
 * Drives the verification session lifecycle for the public + client APIs
 * (Phase 6). Each step runs inline **mock** providers (Phase 7 swaps these for
 * driver packages) and persists their output; `complete` aggregates the
 * persisted signals, runs the decision engine, and lands a final decision.
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
    if (session.status === 'pending') {
      await this.transition(session, 'started')
    }
    return session
  }

  /**
   * Persist a document side. The front capture runs mock OCR + portrait
   * extraction and advances the session to `document_submitted`.
   */
  async submitDocument (
    session: VerificationSession,
    side: 'front' | 'back',
    input: {
      country?: string | null
      documentType?: DocumentType | null
      signals?: MockSignals
    },
  ): Promise<DocumentCapture> {
    this.assertMutable(session)

    const capture =
      (await DocumentCapture.where({ sessionId: session.id }).first()) ??
      (await DocumentCapture.create({
        tenantId: session.tenantId,
        projectId: session.projectId,
        sessionId: session.id,
      }))

    if (input.country !== undefined) capture.country = input.country
    if (input.documentType !== undefined) capture.documentType = input.documentType
    if (side === 'front') capture.frontImagePath = objectPath(session, 'documents/front.jpg')
    else capture.backImagePath = objectPath(session, 'documents/back.jpg')

    if (side === 'front') {
      capture.qualityScore = clamp01(input.signals?.qualityScore ?? 0.9)
    }
    await capture.save()

    // The front side carries the readable data — run OCR + portrait off it.
    if (side === 'front') {
      const ocr = mockOcr(input.signals)
      await OcrResult.create({
        tenantId: session.tenantId,
        projectId: session.projectId,
        sessionId: session.id,
        documentCaptureId: capture.id,
        fields: ocr.fields,
        confidence: ocr.confidence,
        rawResponse: ocr.raw,
      })

      const portrait = mockPortrait()
      await DocumentPortrait.create({
        tenantId: session.tenantId,
        projectId: session.projectId,
        sessionId: session.id,
        documentCaptureId: capture.id,
        portraitImagePath: objectPath(session, 'documents/portrait.jpg'),
        detectionConfidence: portrait.detectionConfidence,
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
    input: { signals?: MockSignals },
  ): Promise<LivenessCheck> {
    this.assertMutable(session)
    RequestException.abortIf(
      session.status === 'pending' || session.status === 'started',
      'Submit a document before the liveness check',
      409,
    )

    const result = mockLiveness(input.signals)
    const check = await LivenessCheck.create({
      tenantId: session.tenantId,
      projectId: session.projectId,
      sessionId: session.id,
      selfieImagePath: objectPath(session, 'liveness/selfie.jpg'),
      score: result.score,
      passed: result.passed,
      spoofSignals: result.spoofSignals,
      provider: 'mock',
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
    input: { signals?: MockSignals },
  ): Promise<VerificationSession> {
    this.assertMutable(session)

    const capture = await DocumentCapture.where({ sessionId: session.id }).first()
    const ocr = await OcrResult.where({ sessionId: session.id }).first()
    const liveness = await LivenessCheck.where({ sessionId: session.id }).first()
    RequestException.assertFound(capture, 'No document has been submitted', 409)
    RequestException.assertFound(ocr, 'No document has been submitted', 409)
    RequestException.assertFound(liveness, 'No liveness check has been submitted', 409)

    const portrait = await DocumentPortrait.where({ sessionId: session.id }).first()
    const faceMatch = mockFaceMatch(input.signals)
    await FaceMatchCheck.create({
      tenantId: session.tenantId,
      projectId: session.projectId,
      sessionId: session.id,
      idPortraitImagePath: portrait?.portraitImagePath ?? null,
      selfieImagePath: liveness.selfieImagePath,
      similarityScore: faceMatch.similarityScore,
      confidence: faceMatch.confidence,
      passed: faceMatch.passed,
      provider: 'mock',
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
    this.assertMutable(session)
    await this.transition(session, 'cancelled')
    return session
  }

  /** Guard: reject mutations on a session that has already reached an end state. */
  private assertMutable (session: VerificationSession): void {
    RequestException.abortIf(
      isTerminalStatus(session.status),
      `Session is ${session.status} and can no longer be modified`,
      409,
    )
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
