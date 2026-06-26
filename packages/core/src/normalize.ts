import type {
  AddressOnFail,
  AddressResultData,
  FaceMatchResultData,
  IsoDateTime,
  LivenessResultData,
  OcrResultData,
  WebhookChecks,
} from '@arkyc/types'

import type { DecisionInput } from './decision'
import { SessionRules } from './session'

/**
 * The raw provider outputs gathered for a session, plus the document quality.
 * `address` is only present when the (opt-in) address stage ran.
 */
export interface SessionSignals {
  documentQualityScore: number
  ocr: OcrResultData
  liveness: LivenessResultData
  faceMatch: FaceMatchResultData
  /** Address-verification result, when the address stage ran. */
  address?: AddressResultData
  /** What a failed address does, from the workflow's address config. */
  addressOnFail?: AddressOnFail
}

/** Normalisation of gathered provider results into engine/webhook shapes. */
export class Normalize {
  /**
   * Normalise gathered provider results into the flat {@link DecisionInput} the
   * decision engine consumes. Document expiry is derived from the OCR `expiryDate`
   * field relative to `now`.
   *
   * @param signals
   * @param now
   * @returns
   */
  static toDecisionInput(signals: SessionSignals, now: IsoDateTime | Date): DecisionInput {
    return {
      document: {
        qualityScore: signals.documentQualityScore,
        ocrConfidence: signals.ocr.confidence,
        expired: SessionRules.isDocumentExpired(signals.ocr.fields.expiryDate, now),
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
      // Absent address stage passes through so it can't veto a decision.
      address: signals.address
        ? { passed: signals.address.passed, score: signals.address.score, onFail: signals.addressOnFail }
        : { passed: true, score: 1 },
    }
  }

  /**
   * Build the `checks` summary embedded in webhook payloads from the same
   * gathered signals.
   *
   * @param signals
   * @param now
   * @returns
   */
  static toWebhookChecks(signals: SessionSignals, now: IsoDateTime | Date): WebhookChecks {
    return {
      document: {
        quality_score: signals.documentQualityScore,
        ocr_confidence: signals.ocr.confidence,
        expired: SessionRules.isDocumentExpired(signals.ocr.fields.expiryDate, now),
      },
      liveness: {
        passed: signals.liveness.passed,
        score: signals.liveness.score,
      },
      face_match: {
        passed: signals.faceMatch.passed,
        similarity_score: signals.faceMatch.similarityScore,
      },
      ...(signals.address
        ? {
            address: {
              passed: signals.address.passed,
              score: signals.address.score,
              methods: signals.address.methods.map((m) => m.method),
            },
          }
        : {}),
    }
  }
}
