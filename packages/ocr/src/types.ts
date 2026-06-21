import type { DocumentType, OcrResultData } from '@arkyc/types'

/** The bytes + context handed to an OCR driver for extraction. */
export interface OcrRequest {
  /** Raw document-front image bytes. */
  image: Uint8Array
  /** Optional hint about the document category. */
  documentType?: DocumentType | null
  /** Optional ISO country code hint. */
  country?: string | null
  /**
   * Optional deterministic signals (used by the `mock` driver and tests to
   * steer the extracted confidence / expiry). Ignored by real drivers.
   */
  hints?: { confidence?: number; expired?: boolean }
}

/** A pluggable OCR provider. */
export interface OcrDriver {
  readonly name: string
  extract(request: OcrRequest): Promise<OcrResultData>
}

/** Identifier for a registered OCR driver. */
export type OcrDriverName = 'mock' | 'external'

/** Configuration selecting + parameterising the active OCR driver. */
export interface OcrConfig {
  driver: OcrDriverName
  /** Base URL for the `external` driver. */
  endpoint?: string
  apiKey?: string
}
