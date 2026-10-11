import type { OcrFields, RiskSignal, RiskSignalKey, ScreeningHit, WorkflowConfig } from '@arkyc/types'
import type { DocumentCapture } from '@app/models/DocumentCapture'
import type { OcrResult } from '@app/models/OcrResult'
import type { VerificationSession } from '@app/models/VerificationSession'

/** What the detectors know about a session when it is decided. */
export interface RiskContext {
  session: VerificationSession
  workflow: WorkflowConfig | null
  capture: DocumentCapture | null
  ocr: OcrResult | null
  /** The liveness selfie, when the session has one. */
  selfie: Uint8Array | null
}

/** A signal tagged with the detector that raised it. */
export interface DetectedSignal extends RiskSignal {
  source: string
}

/** Raises risk signals for one concern (documents, duplicates, devices, ...). */
export interface RiskDetector {
  readonly source: string
  detect(context: RiskContext): Promise<RiskSignal[]>
}

/**
 * The full name OCR extracted, or `null`.
 *
 * @param fields
 * @returns
 */
export function extractedName(fields: OcrFields | undefined): string | null {
  const name = fields?.fullName ?? [fields?.firstName, fields?.lastName].filter(Boolean).join(' ')

  return name?.trim() || null
}

/** Signal keys raised by watchlist screening. */
export const SCREENING_SIGNALS: readonly RiskSignalKey[] = ['sanctions_match', 'pep_match', 'adverse_media']

/**
 * Every watchlist hit carried by screening signals, best first.
 *
 * @param signals
 * @returns
 */
export function screeningHits(signals: RiskSignal[]): ScreeningHit[] {
  return signals
    .filter((signal) => SCREENING_SIGNALS.includes(signal.key))
    .flatMap((signal) => (signal.evidence.hits as ScreeningHit[] | undefined) ?? [])
    .sort((a, b) => b.score - a.score)
}
