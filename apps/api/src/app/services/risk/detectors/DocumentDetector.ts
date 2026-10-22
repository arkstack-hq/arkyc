import { DocumentChecks, ageOn } from '@arkyc/ocr'
import type { OcrAuthenticity, RiskSignal } from '@arkyc/types'
import type { RiskContext, RiskDetector } from '../types'

/** Tampering, inconsistent documents and underage holders. */
export class DocumentDetector implements RiskDetector {
  readonly source = 'document'

  async detect({ ocr, workflow }: RiskContext): Promise<RiskSignal[]> {
    if (!ocr) return []

    const signals: RiskSignal[] = []

    const authenticity = (ocr.rawResponse as { authenticity?: OcrAuthenticity | null } | null)?.authenticity

    if (authenticity && !authenticity.genuine) {
      signals.push({
        key: 'document_tampering',
        severity: 'review',
        score: 0.6,
        advisory: true,
        evidence: {
          confidence: authenticity.confidence,
          screen_replay: authenticity.screenReplay,
          photocopy: authenticity.photocopy,
          digital_tampering: authenticity.digitalTampering,
          physical_tampering: authenticity.physicalTampering,
          observations: authenticity.observations,
        },
      })
    }

    const issues = DocumentChecks.inspect({ fields: ocr.fields, raw: ocr.rawResponse })

    if (issues.length) {
      signals.push({ key: 'document_inconsistent', severity: 'review', score: 0.5, evidence: { issues } })
    }

    const minAge = workflow?.options.min_age
    const age = ocr.fields.dateOfBirth ? ageOn(ocr.fields.dateOfBirth) : null

    if (minAge && age !== null && age < minAge) {
      signals.push({ key: 'underage', severity: 'review', score: 0.7, evidence: { age, min_age: minAge } })
    }

    return signals
  }
}
