import { env } from '@arkstack/common'
import {
  type OcrDriver,
  type OcrDriverName,
  OcrDriverFactory,
  TesseractOcrDriver,
  createDocumentParserRegistry,
} from '@arkyc/ocr'
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
const ocrFallbackDriverName = env('OCR_FALLBACK_DRIVER', 'mock') as OcrDriverName
const ocrLanguage = env('OCR_LANGUAGE', 'eng')

/**
 * Build an OCR driver by name. For the `tesseract` engine, seed its parser
 * registry with the app's custom document parsers (see `./document-parsers`);
 * other drivers are resolved by the factory.
 *
 * @param driver
 */
function buildOcrDriver(driver: OcrDriverName): OcrDriver {
  if (driver === 'tesseract') {
    const registry = createDocumentParserRegistry()
    for (const parser of documentParsers) registry.register(parser)

    return new TesseractOcrDriver({ language: ocrLanguage, registry })
  }

  return OcrDriverFactory.create({
    driver,
    endpoint: env('OCR_ENDPOINT'),
    apiKey: env('OCR_API_KEY'),
    language: ocrLanguage,
    model: env('OCR_AI_MODEL'),
    maxEdge: env('OCR_AI_MAX_EDGE') ? Number(env('OCR_AI_MAX_EDGE')) : undefined,
  })
}

/** Primary OCR driver selected by `OCR_DRIVER`. */
export const ocrDriver = buildOcrDriver(ocrDriverName)

/**
 * Fallback OCR driver (`OCR_FALLBACK_DRIVER`, default `mock`). Used when the
 * primary driver is a gated capability the project isn't permitted to use —
 * today only the `ai` driver is gated. Reuses the primary instance when the two
 * names match so a shared driver isn't built twice.
 */
export const fallbackOcrDriver =
  ocrFallbackDriverName === ocrDriverName ? ocrDriver : buildOcrDriver(ocrFallbackDriverName)

/**
 * Resolve the OCR driver for a request. AI processing is a per-project gated
 * capability: when it isn't enabled for the project, the `ai` primary falls back
 * to {@link fallbackOcrDriver}. Every other primary is ungated and returned as-is.
 *
 * @param aiEnabled whether AI document processing is granted for the project
 */
export function resolveOcrDriver(aiEnabled: boolean): OcrDriver {
  if (ocrDriverName === 'ai' && !aiEnabled) return fallbackOcrDriver

  return ocrDriver
}

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
