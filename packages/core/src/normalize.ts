import type {
  FaceMatchResultData,
  IsoDateTime,
  LivenessResultData,
  OcrResultData,
  WebhookChecks,
} from '@arkyc/types';
import type { DecisionInput } from './decision';
import { isDocumentExpired } from './session';

/** The raw provider outputs gathered for a session, plus the document quality. */
export interface SessionSignals {
  documentQualityScore: number;
  ocr: OcrResultData;
  liveness: LivenessResultData;
  faceMatch: FaceMatchResultData;
}

/**
 * Normalise gathered provider results into the flat {@link DecisionInput} the
 * decision engine consumes. Document expiry is derived from the OCR `expiryDate`
 * field relative to `now`.
 */
export function buildDecisionInput(
  signals: SessionSignals,
  now: IsoDateTime | Date,
): DecisionInput {
  return {
    document: {
      qualityScore: signals.documentQualityScore,
      ocrConfidence: signals.ocr.confidence,
      expired: isDocumentExpired(signals.ocr.fields.expiryDate, now),
    },
    liveness: {
      passed: signals.liveness.passed,
      score: signals.liveness.score,
      multipleFaces: signals.liveness.spoofSignals.multipleFaces === true,
    },
    faceMatch: {
      passed: signals.faceMatch.passed,
      similarityScore: signals.faceMatch.similarityScore,
    },
  };
}

/**
 * Build the `checks` summary embedded in webhook payloads from the same
 * gathered signals.
 */
export function buildWebhookChecks(
  signals: SessionSignals,
  now: IsoDateTime | Date,
): WebhookChecks {
  return {
    document: {
      quality_score: signals.documentQualityScore,
      ocr_confidence: signals.ocr.confidence,
      expired: isDocumentExpired(signals.ocr.fields.expiryDate, now),
    },
    liveness: {
      passed: signals.liveness.passed,
      score: signals.liveness.score,
    },
    face_match: {
      passed: signals.faceMatch.passed,
      similarity_score: signals.faceMatch.similarityScore,
    },
  };
}
