import type { DecisionReason, VerificationDecision, VerificationThresholds } from '@arkyc/types'

import { Risk } from './risk'
import { Thresholds } from './thresholds'

/** Document signals fed to the decision engine. */
export interface DecisionDocumentInput {
  /** Document image quality in [0, 1]. */
  qualityScore: number
  /** OCR extraction confidence in [0, 1]. */
  ocrConfidence: number
  /** Whether the document is past its expiry date. */
  expired: boolean
}

/** Liveness signals fed to the decision engine. */
export interface DecisionLivenessInput {
  passed: boolean
  /** Liveness confidence in [0, 1]. */
  score: number
  /** Whether more than one face was detected in the selfie/liveness frame. */
  multipleFaces?: boolean
}

/** Face-match signals fed to the decision engine. */
export interface DecisionFaceMatchInput {
  passed: boolean
  /** Similarity between document portrait and selfie in [0, 1]. */
  similarityScore: number
}

/** Address-verification signals fed to the decision engine. */
export interface DecisionAddressInput {
  passed: boolean
  /** Overall address-verification confidence in [0, 1]. */
  score: number
  /**
   * What a failed result does: flag for `review` (default) or `reject`, driven
   * by the workflow's address config. A low-confidence (but not failed) result
   * is always review, never a reject.
   */
  onFail?: 'review' | 'reject'
}

/** The complete set of signals the decision engine evaluates. */
export interface DecisionInput {
  document: DecisionDocumentInput
  liveness: DecisionLivenessInput
  faceMatch: DecisionFaceMatchInput
  address: DecisionAddressInput
}

/** The decision engine's verdict for a session. */
export interface DecisionResult {
  decision: VerificationDecision
  reason: DecisionReason
  /** Aggregate risk score in [0, 1] (higher = riskier). */
  riskScore: number
}

/** Deterministic verification decision engine. */
export class DecisionEngine {
  /**
   * Decide a verification outcome from the gathered signals.
   *
   * Hard failures reject outright; borderline/low-confidence signals route to
   * manual review; everything clearing its threshold is auto-approved. Checks are
   * evaluated in a fixed priority order so the result is deterministic.
   *
   * Reject precedence:  expired → liveness failed → face-match failed
   * Review precedence:   multiple faces → low quality → low OCR
   *                       → low liveness → low face-match
   *
   * @param input
   * @param thresholds
   * @returns
   */
  static decide(input: DecisionInput, thresholds?: Partial<VerificationThresholds>): DecisionResult {
    const t = Thresholds.resolve(thresholds)
    const riskScore = Risk.score(input)
    const verdict = (decision: VerificationDecision, reason: DecisionReason): DecisionResult => ({
      decision,
      reason,
      riskScore,
    })

    // --- Hard rejections (highest priority) ---
    if (input.document.expired) {
      return verdict('rejected', 'DOCUMENT_EXPIRED')
    }
    if (!input.liveness.passed) {
      return verdict('rejected', 'LIVENESS_FAILED')
    }
    if (!input.faceMatch.passed) {
      return verdict('rejected', 'FACE_MATCH_FAILED')
    }
    // Address only rejects when the workflow opts in (`on_fail: 'reject'`);
    // otherwise a failed address falls through to manual review below.
    if (!input.address.passed && input.address.onFail === 'reject') {
      return verdict('rejected', 'ADDRESS_VERIFICATION_FAILED')
    }

    // --- Manual review (borderline / ambiguous signals) ---
    if (input.liveness.multipleFaces === true) {
      return verdict('requires_review', 'MULTIPLE_FACES_DETECTED')
    }
    if (input.document.qualityScore < t.documentQualityThreshold) {
      return verdict('requires_review', 'LOW_DOCUMENT_QUALITY')
    }
    if (input.document.ocrConfidence < t.ocrConfidenceThreshold) {
      return verdict('requires_review', 'OCR_LOW_CONFIDENCE')
    }
    if (input.liveness.score < t.livenessThreshold) {
      return verdict('requires_review', 'LIVENESS_LOW_CONFIDENCE')
    }
    if (input.faceMatch.similarityScore < t.faceMatchThreshold) {
      return verdict('requires_review', 'FACE_MATCH_LOW_CONFIDENCE')
    }
    // A failed address that didn't reject (on_fail: 'review') lands here.
    if (!input.address.passed) {
      return verdict('requires_review', 'ADDRESS_VERIFICATION_FAILED')
    }
    if (input.address.score < t.addressThreshold) {
      return verdict('requires_review', 'ADDRESS_LOW_CONFIDENCE')
    }

    // --- All checks cleared ---
    return verdict('approved', 'AUTO_APPROVED')
  }
}
