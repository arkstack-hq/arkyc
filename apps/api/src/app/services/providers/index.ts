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

/**
 * Memoize a factory so the driver is built once, on first use.
 *
 * Construction is deferred (NOT at module load) on purpose: env vars must be
 * read at request time, not import time. The API loads `.env` via `dotenv`
 * during bootstrap, and the build can reorder ES imports so this module
 * evaluates before that runs — eager `env('OCR_DRIVER')` reads then see
 * `undefined` and silently fall back to the `mock` defaults, even though the
 * process later has `OCR_DRIVER=ai`. Lazy construction removes that ordering
 * hazard entirely (the admin "Environment" panel, which reads env per-request,
 * is the source of truth these now agree with).
 */
function lazy<T>(factory: () => T): () => T {
  let instance: T | undefined

  return () => (instance ??= factory())
}

const ocrDriverName = (): OcrDriverName => env('OCR_DRIVER', 'mock') as OcrDriverName
const ocrFallbackDriverName = (): OcrDriverName => env('OCR_FALLBACK_DRIVER', 'mock') as OcrDriverName

/**
 * Build an OCR driver by name. For the `tesseract` engine, seed its parser
 * registry with the app's custom document parsers (see `./document-parsers`);
 * other drivers are resolved by the factory.
 *
 * @param driver
 */
function buildOcrDriver(driver: OcrDriverName): OcrDriver {
  const language = env('OCR_LANGUAGE', 'eng')

  if (driver === 'tesseract') {
    const registry = createDocumentParserRegistry()
    for (const parser of documentParsers) registry.register(parser)

    return new TesseractOcrDriver({ language, registry })
  }

  return OcrDriverFactory.create({
    driver,
    endpoint: env('OCR_ENDPOINT'),
    apiKey: env('OCR_API_KEY'),
    language,
    model: env('OCR_AI_MODEL'),
    maxEdge: env('OCR_AI_MAX_EDGE') ? Number(env('OCR_AI_MAX_EDGE')) : undefined,
  })
}

/** Primary OCR driver selected by `OCR_DRIVER` (built once, on first use). */
const primaryOcrDriver = lazy<OcrDriver>(() => buildOcrDriver(ocrDriverName()))

/**
 * Fallback OCR driver (`OCR_FALLBACK_DRIVER`, default `mock`). Used when the
 * primary driver is a gated capability the project isn't permitted to use —
 * today only the `ai` driver is gated. Reuses the primary instance when the two
 * names match so a shared driver isn't built twice.
 */
const fallbackOcrDriver = lazy<OcrDriver>(() =>
  ocrFallbackDriverName() === ocrDriverName() ? primaryOcrDriver() : buildOcrDriver(ocrFallbackDriverName()),
)

/**
 * Resolve the OCR driver for a request. AI processing is a per-project gated
 * capability: when it isn't enabled for the project, the `ai` primary falls back
 * to the fallback driver. Every other primary is ungated and returned as-is.
 *
 * @param aiEnabled whether AI document processing is granted for the project
 */
export function resolveOcrDriver(aiEnabled: boolean): OcrDriver {
  if (ocrDriverName() === 'ai' && !aiEnabled) return fallbackOcrDriver()

  return primaryOcrDriver()
}

/** Liveness driver selected by `LIVENESS_DRIVER` (built once, on first use). */
export const livenessDriver = lazy(() =>
  LivenessDriverFactory.create({
    driver: env('LIVENESS_DRIVER', 'mock') as LivenessDriverName,
    endpoint: env('LIVENESS_ENDPOINT'),
    apiKey: env('LIVENESS_API_KEY'),
  }),
)

/** Face-match driver selected by `FACE_MATCH_DRIVER` (built once, on first use). */
export const faceMatchDriver = lazy(() =>
  FaceMatchDriverFactory.create({
    driver: env('FACE_MATCH_DRIVER', 'mock') as FaceMatchDriverName,
    endpoint: env('FACE_MATCH_ENDPOINT'),
    apiKey: env('FACE_MATCH_API_KEY'),
  }),
)
