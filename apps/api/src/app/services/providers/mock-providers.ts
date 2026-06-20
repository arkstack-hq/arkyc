import type {
  FaceMatchResultData,
  LivenessResultData,
  OcrResultData,
} from '@arkyc/types'

/**
 * Inline mock verification providers (Phase 6).
 *
 * These stand in for the real driver-based packages (`@arkyc/ocr`,
 * `@arkyc/liveness`, `@arkyc/face-match`) that land in Phase 7. They produce
 * passing scores by default, but accept optional hints so a caller (or test)
 * can steer a session toward `approved | rejected | requires_review`.
 */

/** Hints a client may pass to shape the mock provider output. */
export interface MockSignals {
  /** Document image quality in [0, 1]. */
  qualityScore?: number
  /** OCR extraction confidence in [0, 1]. */
  ocrConfidence?: number
  /** Whether the document is past its expiry. */
  expired?: boolean
  /** Liveness confidence in [0, 1]. */
  livenessScore?: number
  /** Force the liveness pass/fail verdict (defaults to score >= 0.5). */
  livenessPassed?: boolean
  /** Whether more than one face was detected. */
  multipleFaces?: boolean
  /** Document-portrait ↔ selfie similarity in [0, 1]. */
  faceSimilarity?: number
  /** Force the face-match pass/fail verdict (defaults to similarity >= 0.5). */
  faceMatchPassed?: boolean
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** Mock OCR: returns fixed identity fields and the requested confidence. */
export function mockOcr (signals: MockSignals = {}): OcrResultData {
  const confidence = clamp01(signals.ocrConfidence ?? 0.92)

  return {
    fields: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      dateOfBirth: '1990-01-01',
      documentNumber: 'X1234567',
      expiryDate: signals.expired ? '2000-01-01' : '2035-01-01',
      nationality: 'GB',
    },
    confidence,
    raw: { provider: 'mock', confidence },
  }
}

/** Mock portrait extraction: a fixed detection confidence. */
export function mockPortrait (): { detectionConfidence: number } {
  return { detectionConfidence: 0.95 }
}

/** Mock passive liveness: derives pass/fail and spoof signals from hints. */
export function mockLiveness (signals: MockSignals = {}): LivenessResultData {
  const score = clamp01(signals.livenessScore ?? 0.94)
  const passed = signals.livenessPassed ?? score >= 0.5

  return {
    passed,
    score,
    spoofSignals: {
      screenReplay: false,
      printedPhoto: false,
      maskDetected: false,
      multipleFaces: signals.multipleFaces ?? false,
      faceNotCentered: false,
      poorLighting: false,
    },
    raw: { provider: 'mock', score },
  }
}

/** Mock face match: derives pass/fail from the requested similarity. */
export function mockFaceMatch (signals: MockSignals = {}): FaceMatchResultData {
  const similarityScore = clamp01(signals.faceSimilarity ?? 0.9)
  const passed = signals.faceMatchPassed ?? similarityScore >= 0.5

  return {
    passed,
    similarityScore,
    confidence: 0.93,
    raw: { provider: 'mock', similarityScore },
  }
}
