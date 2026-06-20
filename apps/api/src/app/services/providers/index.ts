import { type OcrDriverName, createOcrDriver } from '@arkyc/ocr'
import { type LivenessDriverName, createLivenessDriver } from '@arkyc/liveness'
import { type FaceMatchDriverName, createFaceMatchDriver } from '@arkyc/face-match'

/**
 * Verification provider wiring (Phase 7).
 *
 * Analyzer drivers are selected by env (`OCR_DRIVER`, `LIVENESS_DRIVER`,
 * `FACE_MATCH_DRIVER`) and default to the deterministic `mock` drivers so dev +
 * tests work with no configuration. Call sites depend only on the driver
 * interfaces, so switching a driver needs no code changes. File storage is
 * handled by Arkstack's `Storage` (see `config/filesystem`).
 */

const env = process.env

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

export const ocrDriver = createOcrDriver({
  driver: (env.OCR_DRIVER as OcrDriverName) ?? 'mock',
  endpoint: env.OCR_ENDPOINT,
  apiKey: env.OCR_API_KEY,
})

export const livenessDriver = createLivenessDriver({
  driver: (env.LIVENESS_DRIVER as LivenessDriverName) ?? 'mock',
  endpoint: env.LIVENESS_ENDPOINT,
  apiKey: env.LIVENESS_API_KEY,
})

export const faceMatchDriver = createFaceMatchDriver({
  driver: (env.FACE_MATCH_DRIVER as FaceMatchDriverName) ?? 'mock',
  endpoint: env.FACE_MATCH_ENDPOINT,
  apiKey: env.FACE_MATCH_API_KEY,
})
