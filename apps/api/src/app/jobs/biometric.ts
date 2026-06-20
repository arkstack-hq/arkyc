import {
  type DecisionInput,
  assertTransition,
  decideVerification,
  isDocumentExpired,
} from '@arkyc/core'
import { faceMatchDriver } from '@app/services/providers'
import { audit } from '@app/services/AuditLogger'
import { readObject } from 'src/support/storage'
import { VerificationSession } from '@app/models/VerificationSession'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { OcrResult } from '@app/models/OcrResult'
import { DocumentPortrait } from '@app/models/DocumentPortrait'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { FaceMatchCheck } from '@app/models/FaceMatchCheck'
import { Project } from '@app/models/Project'

export interface BiometricJobPayload {
  sessionId: string
  hints?: { faceSimilarity?: number; faceMatchPassed?: boolean }
}

/**
 * Biometric worker (queue `biometric`): runs face match, aggregates the
 * persisted signals through the decision engine, and lands the session's final
 * decision. Only acts on a `processing` session (idempotent on re-delivery) and
 * throws if OCR/liveness aren't ready yet so the job retries with backoff.
 */
export async function biometricJob (payload: BiometricJobPayload): Promise<void> {
  const session = await VerificationSession.where({ id: payload.sessionId }).first()
  if (!session || session.status !== 'processing') return

  const capture = await DocumentCapture.where({ sessionId: session.id }).first()
  const ocr = await OcrResult.where({ sessionId: session.id }).first()
  const liveness = await LivenessCheck.where({ sessionId: session.id }).first()
  if (!capture || !ocr || !liveness) {
    throw new Error('OCR/liveness results are not ready yet')
  }

  const portrait = await DocumentPortrait.where({ sessionId: session.id }).first()
  const faceMatch = await faceMatchDriver.compare({
    documentPortrait: await readObject(portrait?.portraitImagePath),
    selfie: await readObject(liveness.selfieImagePath),
    hints: {
      similarityScore: payload.hints?.faceSimilarity,
      passed: payload.hints?.faceMatchPassed,
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
  session.status = assertTransition(session.status, decision)
  await session.save()

  await audit.record({
    tenantId: session.tenantId,
    projectId: session.projectId,
    actorType: 'system',
    action: 'session.auto_decided',
    entityType: 'verification_session',
    entityId: session.id,
    metadata: { decision, reason, riskScore },
  })
}
