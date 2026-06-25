import { Job } from '@arkstack/jobs'
import { type DecisionInput, DecisionEngine, SessionRules } from '@arkyc/core'
import { workflowEnables, workflowRunsOcr } from '@arkyc/types'
import { faceMatchDriver } from '@app/services/providers'
import { audit } from '@app/services/AuditLogger'
import { readObject } from 'src/support/storage'
import { transitionTo } from 'src/support/session-transition'
import { VerificationSession } from '@app/models/VerificationSession'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { OcrResult } from '@app/models/OcrResult'
import { DocumentPortrait } from '@app/models/DocumentPortrait'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { FaceMatchCheck } from '@app/models/FaceMatchCheck'
import { Project } from '@app/models/Project'

export interface BiometricJobHints {
  faceSimilarity?: number
  faceMatchPassed?: boolean
}

/**
 * Biometric job (queue `biometric`): runs face match, aggregates the persisted
 * signals through the decision engine, and lands the session's final decision.
 * Only acts on a `processing` session (idempotent on re-delivery) and throws if
 * OCR/liveness aren't ready yet so the job retries with backoff.
 */
export class BiometricJob extends Job {
  override queue = 'biometric'
  override tries = 5
  override backoff = 5

  constructor(
    public sessionId: string,
    public hints: BiometricJobHints = {},
  ) {
    super()
  }

  async handle(): Promise<void> {
    const session = await VerificationSession.where({ id: this.sessionId }).first()
    if (!session || session.status !== 'processing') return

    // The workflow decides which stages run. Face match additionally needs a
    // document portrait (from OCR) and a liveness selfie, so it only runs when
    // all three of its sources are on.
    const workflow = session.workflow
    const runsDocument = workflowEnables(workflow, 'document')
    const runsOcr = workflowRunsOcr(workflow)
    const runsLiveness = workflowEnables(workflow, 'liveness')
    const runsFaceMatch = workflowEnables(workflow, 'face_match') && runsOcr && runsLiveness

    const capture = runsDocument ? await DocumentCapture.where({ sessionId: session.id }).first() : null
    const ocr = runsOcr ? await OcrResult.where({ sessionId: session.id }).first() : null
    const liveness = runsLiveness ? await LivenessCheck.where({ sessionId: session.id }).first() : null

    // Stages that run must have landed their results before deciding. OCR is
    // async, so an early run throws to retry with backoff.
    if (runsDocument && !capture) throw new Error('Document capture is not ready yet')
    if (runsOcr && !ocr) throw new Error('OCR result is not ready yet')
    if (runsLiveness && !liveness) throw new Error('Liveness result is not ready yet')

    let faceMatch: { passed: boolean; similarityScore: number } | null = null
    if (runsFaceMatch) {
      const portrait = await DocumentPortrait.where({ sessionId: session.id }).first()
      if (!portrait) throw new Error('Document portrait is not ready yet')

      const faceMatcher = faceMatchDriver()
      const result = await faceMatcher.compare({
        documentPortrait: await readObject(portrait.portraitImagePath),
        selfie: await readObject(liveness!.selfieImagePath),
        hints: { similarityScore: this.hints.faceSimilarity, passed: this.hints.faceMatchPassed },
      })
      await FaceMatchCheck.create({
        organizationId: session.organizationId,
        projectId: session.projectId,
        sessionId: session.id,
        idPortraitImagePath: portrait.portraitImagePath,
        selfieImagePath: liveness!.selfieImagePath,
        similarityScore: result.similarityScore,
        confidence: result.confidence,
        passed: result.passed,
        provider: faceMatcher.name,
        rawResponse: result.raw,
      })
      faceMatch = { passed: result.passed, similarityScore: result.similarityScore }
    }

    // Disabled or skipped stages pass through so they can't fail or flag the user.
    const decisionInput: DecisionInput = {
      document: runsDocument
        ? {
            qualityScore: capture!.qualityScore ?? 0,
            ocrConfidence: runsOcr ? ocr!.confidence : 1,
            expired: runsOcr ? SessionRules.isDocumentExpired(ocr!.fields.expiryDate, new Date()) : false,
          }
        : { qualityScore: 1, ocrConfidence: 1, expired: false },
      liveness: runsLiveness
        ? {
            passed: liveness!.passed,
            score: liveness!.score,
            multipleFaces: liveness!.spoofSignals?.multipleFaces ?? false,
          }
        : { passed: true, score: 1, multipleFaces: false },
      faceMatch: faceMatch ?? { passed: true, similarityScore: 1 },
    }

    const project = await Project.where({ id: session.projectId }).first()
    const { decision, reason, riskScore } = DecisionEngine.decide(decisionInput, project?.settings?.thresholds)

    session.autoDecision = decision
    session.decisionReason = reason
    session.riskScore = riskScore
    // Auto outcomes are final; `requires_review` waits for a human (Phase 9).
    if (decision === 'approved' || decision === 'rejected') {
      session.finalDecision = decision
      session.completedAt = new Date()
    }
    await transitionTo(session, decision)

    await audit.record({
      organizationId: session.organizationId,
      projectId: session.projectId,
      actorType: 'system',
      action: 'session.auto_decided',
      entityType: 'verification_session',
      entityId: session.id,
      metadata: { decision, reason, riskScore },
    })
  }
}
