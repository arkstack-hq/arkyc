import { env } from '@arkstack/common'
import { type OcrDriverName, OcrDriverFactory, TesseractOcrDriver, createDocumentParserRegistry } from '@arkyc/ocr'
import { type LivenessDriverName, LivenessDriverFactory } from '@arkyc/liveness'
import { type FaceMatchDriverName, FaceMatchDriverFactory } from '@arkyc/face-match'
import { documentParsers } from './document-parsers'

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

const ocrDriverName = env('OCR_DRIVER', 'mock') as OcrDriverName
const ocrLanguage = env('OCR_LANGUAGE', 'eng')

/**
 * Build the OCR driver. For the `tesseract` engine, seed its parser registry with
 * the app's custom document parsers (see `./document-parsers`); other drivers are
 * resolved by the factory.
 */
function buildOcrDriver() {
  if (ocrDriverName === 'tesseract') {
    const registry = createDocumentParserRegistry()
    for (const parser of documentParsers) registry.register(parser)
    return new TesseractOcrDriver({ language: ocrLanguage, registry })
  }
  return OcrDriverFactory.create({
    driver: ocrDriverName,
    endpoint: env('OCR_ENDPOINT'),
    apiKey: env('OCR_API_KEY'),
    language: ocrLanguage,
  })
}

export const ocrDriver = buildOcrDriver()

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
