import type {
  DecisionReason,
  VerificationDecision,
  VerificationThresholds,
} from '@arkyc/types';
import { computeRiskScore } from './risk.js';
import { resolveThresholds } from './thresholds.js';

/** Document signals fed to the decision engine. */
export interface DecisionDocumentInput {
  /** Document image quality in [0, 1]. */
  qualityScore: number;
  /** OCR extraction confidence in [0, 1]. */
  ocrConfidence: number;
  /** Whether the document is past its expiry date. */
  expired: boolean;
}

/** Liveness signals fed to the decision engine. */
export interface DecisionLivenessInput {
  passed: boolean;
  /** Liveness confidence in [0, 1]. */
  score: number;
  /** Whether more than one face was detected in the selfie/liveness frame. */
  multipleFaces?: boolean;
}

/** Face-match signals fed to the decision engine. */
export interface DecisionFaceMatchInput {
  passed: boolean;
  /** Similarity between document portrait and selfie in [0, 1]. */
  similarityScore: number;
}

/** The complete set of signals the decision engine evaluates. */
export interface DecisionInput {
  document: DecisionDocumentInput;
  liveness: DecisionLivenessInput;
  faceMatch: DecisionFaceMatchInput;
}

/** The decision engine's verdict for a session. */
export interface DecisionResult {
  decision: VerificationDecision;
  reason: DecisionReason;
  /** Aggregate risk score in [0, 1] (higher = riskier). */
  riskScore: number;
}

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
 */
export function decideVerification(
  input: DecisionInput,
  thresholds?: Partial<VerificationThresholds>,
): DecisionResult {
  const t = resolveThresholds(thresholds);
  const riskScore = computeRiskScore(input);
  const verdict = (decision: VerificationDecision, reason: DecisionReason): DecisionResult => ({
    decision,
    reason,
    riskScore,
  });

  // --- Hard rejections (highest priority) ---
  if (input.document.expired) {
    return verdict('rejected', 'DOCUMENT_EXPIRED');
  }
  if (!input.liveness.passed) {
    return verdict('rejected', 'LIVENESS_FAILED');
  }
  if (!input.faceMatch.passed) {
    return verdict('rejected', 'FACE_MATCH_FAILED');
  }

  // --- Manual review (borderline / ambiguous signals) ---
  if (input.liveness.multipleFaces === true) {
    return verdict('requires_review', 'MULTIPLE_FACES_DETECTED');
  }
  if (input.document.qualityScore < t.documentQualityThreshold) {
    return verdict('requires_review', 'LOW_DOCUMENT_QUALITY');
  }
  if (input.document.ocrConfidence < t.ocrConfidenceThreshold) {
    return verdict('requires_review', 'OCR_LOW_CONFIDENCE');
  }
  if (input.liveness.score < t.livenessThreshold) {
    return verdict('requires_review', 'LIVENESS_LOW_CONFIDENCE');
  }
  if (input.faceMatch.similarityScore < t.faceMatchThreshold) {
    return verdict('requires_review', 'FACE_MATCH_LOW_CONFIDENCE');
  }

  // --- All checks cleared ---
  return verdict('approved', 'AUTO_APPROVED');
}
