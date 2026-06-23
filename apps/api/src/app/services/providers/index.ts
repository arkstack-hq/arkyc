import { env } from '@arkstack/common'
import { type OcrDriverName, OcrDriverFactory } from '@arkyc/ocr'
import { type LivenessDriverName, LivenessDriverFactory } from '@arkyc/liveness'
import { type FaceMatchDriverName, FaceMatchDriverFactory } from '@arkyc/face-match'

/**
 * Verification provider wiring (Phase 7).
 *
 * Analyzer drivers are selected by env (`OCR_DRIVER`, `LIVENESS_DRIVER`,
 * `FACE_MATCH_DRIVER`) and default to the deterministic `mock` drivers so dev +
 * tests work with no configuration. Call sites depend only on the driver
 * interfaces, so switching a driver needs no code changes. File storage is
 * handled by Arkstack's `Storage` (see `config/filesystem`).
 */

/** Optional steering hints for the mock drivers (ignored by real drivers). */
export interface ProviderSignals {
  qualityScore?: number
  ocrConfidence?: number
  expired?: boolean
  livenessScore?: number
  livenessPassed?: boolean
  multipleFaces?: boolean
  faceSimilarity?: number
  faceMatchPassed?: boolean
}

export const ocrDriver = OcrDriverFactory.create({
  driver: env('OCR_DRIVER', 'mock') as OcrDriverName,
  endpoint: env('OCR_ENDPOINT'),
  apiKey: env('OCR_API_KEY'),
  // Tesseract recognition language(s), e.g. `eng` or `eng+fra`.
  language: env('OCR_LANGUAGE', 'eng'),
})

export const livenessDriver = LivenessDriverFactory.create({
  driver: env('LIVENESS_DRIVER', 'mock') as LivenessDriverName,
  endpoint: env('LIVENESS_ENDPOINT'),
  apiKey: env('LIVENESS_API_KEY'),
})

export const faceMatchDriver = FaceMatchDriverFactory.create({
  driver: env('FACE_MATCH_DRIVER', 'mock') as FaceMatchDriverName,
  endpoint: env('FACE_MATCH_ENDPOINT'),
  apiKey: env('FACE_MATCH_API_KEY'),
})
