import type { ScreeningSubject } from '@arkyc/screening'
import {
  workflowScreeningConfig,
  type OcrFields,
  type RiskSignal,
  type RiskSignalKey,
  type ScreeningHit,
  type ScreeningHitCategory,
} from '@arkyc/types'
import { screeningDriver } from '@app/services/providers'
import { reportError } from 'src/support/observability'
import { extractedName, type RiskContext, type RiskDetector } from '../types'

const CATEGORY_SIGNAL: Record<ScreeningHitCategory, RiskSignalKey> = {
  sanction: 'sanctions_match',
  pep: 'pep_match',
  adverse_media: 'adverse_media',
  other: 'adverse_media',
}

const CATEGORY_SCORE: Record<RiskSignalKey, number> = {
  sanctions_match: 0.9,
  pep_match: 0.5,
  adverse_media: 0.4,
} as Record<RiskSignalKey, number>

/** Watchlist hits for the `screening` workflow stage, one signal per hit category. */
export class ScreeningDetector implements RiskDetector {
  readonly source = 'screening'

  async detect({ session, workflow, ocr }: RiskContext): Promise<RiskSignal[]> {
    const config = workflowScreeningConfig(workflow)
    const subject = ScreeningDetector.subject(ocr?.fields)

    if (!config || !subject) return []

    try {
      const { hits } = await screeningDriver.screen(subject, { threshold: config.threshold })

      return ScreeningDetector.signals(hits)
    } catch (error) {
      reportError(error, { scope: 'screening', sessionId: session.id })

      return [
        {
          key: 'sanctions_match',
          severity: 'review',
          score: 0.3,
          advisory: true,
          evidence: { unavailable: true, provider: screeningDriver.name },
        },
      ]
    }
  }

  /**
   * The identity to screen from extracted fields, or `null` without a name.
   *
   * @param fields
   * @returns
   */
  static subject(fields: OcrFields | undefined): ScreeningSubject | null {
    const name = extractedName(fields)

    if (!name) return null

    return {
      name,
      birthDate: fields?.dateOfBirth,
      nationality: fields?.nationality,
      documentNumber: fields?.documentNumber,
    }
  }

  /**
   * Group hits into one signal per category, best hit first.
   *
   * @param hits
   * @returns
   */
  static signals(hits: ScreeningHit[]): RiskSignal[] {
    const byKey = new Map<RiskSignalKey, ScreeningHit[]>()

    for (const hit of hits) {
      const key = CATEGORY_SIGNAL[hit.category]

      byKey.set(key, [...(byKey.get(key) ?? []), hit])
    }

    return [...byKey].map(([key, grouped]) => ({
      key,
      severity: 'review' as const,
      score: CATEGORY_SCORE[key]!,
      evidence: { provider: screeningDriver.name, hits: grouped },
    }))
  }
}
