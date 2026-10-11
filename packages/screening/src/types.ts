import type { ScreeningHit } from '@arkyc/types'

/** The identity being screened. */
export interface ScreeningSubject {
  name: string
  /** ISO 8601 date of birth. */
  birthDate?: string
  /** Nationality as an ISO country code. */
  nationality?: string
  documentNumber?: string
}

export interface ScreeningOptions {
  /** Minimum match score in [0, 1] for a result to count as a hit. */
  threshold: number
}

export interface ScreeningResult {
  /** Hits at or above the threshold, best first. */
  hits: ScreeningHit[]
  /** Provider payload, retained for audit. */
  raw?: unknown
}

/** A pluggable watchlist screening provider. */
export interface ScreeningDriver {
  readonly name: string
  screen(subject: ScreeningSubject, options: ScreeningOptions): Promise<ScreeningResult>
}

export type ScreeningDriverName = 'mock' | 'opensanctions' | 'external'

export interface ScreeningConfig {
  driver: ScreeningDriverName
  /** Provider base URL: the hosted OpenSanctions API, a self-hosted yente, or an external service. */
  endpoint?: string
  apiKey?: string
  /** OpenSanctions dataset or collection to match against. */
  dataset?: string
  /** Request timeout in milliseconds. */
  timeoutMs?: number
}
