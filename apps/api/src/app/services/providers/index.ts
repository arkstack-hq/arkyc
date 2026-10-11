import { env } from '@arkstack/common'
import {
  type OcrDriver,
  type OcrDriverName,
  type AiOcrProvider,
  OcrDriverFactory,
  TesseractOcrDriver,
  createDocumentParserRegistry,
} from '@arkyc/ocr'
import { type LivenessDriverName, LivenessDriverFactory } from '@arkyc/liveness'
import { type FaceMatchDriverName, FaceMatchDriverFactory } from '@arkyc/face-match'
import { type ScreeningDriverName, ScreeningDriverFactory } from '@arkyc/screening'
import { type NetworkDriverName, NetworkDriverFactory } from '@arkyc/network'
import { type AddressDriverName, AddressVerifierFactory } from './address'
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
  fullName?: string
  dateOfBirth?: string
  documentNumber?: string
  addressScore?: number
  addressPassed?: boolean
}

const ocrDriverName = env('OCR_DRIVER', 'mock') as OcrDriverName
const ocrFallbackDriverName = env('OCR_FALLBACK_DRIVER', 'mock') as OcrDriverName
const ocrLanguage = env('OCR_LANGUAGE', 'eng')

/**
 * Vision backend for the `ai` OCR driver. Setting `WORKERS_AI_MODEL` (or
 * `OCR_AI_PROVIDER=workers-ai`, which uses the default Gemma 4 model) switches it
 * to Cloudflare Workers AI; otherwise it talks to Anthropic.
 */
const workersAiModel = env('WORKERS_AI_MODEL')
const ocrAiProvider: AiOcrProvider =
  env('OCR_AI_PROVIDER') === 'workers-ai' || workersAiModel ? 'workers-ai' : 'anthropic'
const workersAi = ocrAiProvider === 'workers-ai'

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
    endpoint: workersAi && driver === 'ai' ? undefined : env('OCR_ENDPOINT'),
    apiKey: workersAi && driver === 'ai' ? env('CLOUDFLARE_API_TOKEN', env('OCR_API_KEY')) : env('OCR_API_KEY'),
    language: ocrLanguage,
    aiProvider: ocrAiProvider,
    accountId: env('CLOUDFLARE_ACCOUNT_ID'),
    model: workersAi ? workersAiModel : env('OCR_AI_MODEL'),
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

/** Where the `local` biometric drivers keep their model files (`ark biometrics:setup` fills it). */
export const biometricModelDirectory = env('BIOMETRICS_MODEL_DIR', 'storage/models')

export const livenessDriver = LivenessDriverFactory.create({
  driver: env('LIVENESS_DRIVER', 'mock') as LivenessDriverName,
  endpoint: env('LIVENESS_ENDPOINT'),
  apiKey: env('LIVENESS_API_KEY'),
  modelDirectory: biometricModelDirectory,
})

export const faceMatchDriver = FaceMatchDriverFactory.create({
  driver: env('FACE_MATCH_DRIVER', 'mock') as FaceMatchDriverName,
  endpoint: env('FACE_MATCH_ENDPOINT'),
  apiKey: env('FACE_MATCH_API_KEY'),
  modelDirectory: biometricModelDirectory,
})

/**
 * Address verifier (opt-in `address` stage). `mock` is the deterministic default;
 * `live` corroborates the address via openrouteservice (forward geocoding) and
 * Nominatim (reverse geocoding from device location).
 */
export const addressVerifier = AddressVerifierFactory.create({
  driver: env('ADDRESS_DRIVER', 'mock') as AddressDriverName,
  orsApiKey: env('ADDRESS_ORS_API_KEY'),
  orsUrl: env('ADDRESS_ORS_URL'),
  nominatimUrl: env('ADDRESS_NOMINATIM_URL'),
  userAgent: env('ADDRESS_USER_AGENT'),
})

/** Watchlist screening for the `screening` workflow stage and ongoing monitoring. */
export const screeningDriver = ScreeningDriverFactory.create({
  driver: env('SCREENING_DRIVER', 'mock') as ScreeningDriverName,
  endpoint: env('SCREENING_ENDPOINT'),
  apiKey: env('SCREENING_API_KEY'),
  dataset: env('SCREENING_DATASET'),
})

/** IP intelligence for network risk signals. */
export const networkDriver = NetworkDriverFactory.create({
  driver: env('NETWORK_DRIVER', 'mock') as NetworkDriverName,
  countryDatabase: env('MAXMIND_COUNTRY_DB'),
  asnDatabase: env('MAXMIND_ASN_DB'),
  anonymousIpDatabase: env('MAXMIND_ANONYMOUS_IP_DB'),
  torExitList: env('TOR_EXIT_LIST'),
})
