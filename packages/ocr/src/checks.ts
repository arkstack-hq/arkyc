import type { OcrFields } from '@arkyc/types'

/** A deterministic inconsistency found on a document. */
export type DocumentIssueCode =
  | 'mrz_check_digit'
  | 'mrz_visual_mismatch'
  | 'issue_after_expiry'
  | 'birth_after_issue'
  | 'birth_in_future'
  | 'implausible_age'

export interface DocumentIssue {
  code: DocumentIssueCode
  /** The fields involved. */
  fields: string[]
}

/** The parts of an OCR result the checks read. */
export interface DocumentCheckInput {
  fields: OcrFields
  /** The driver's raw payload; MRZ check results and visual-zone fields live here. */
  raw?: unknown
  now?: Date
}

interface MrzDetail {
  format?: string
  checks?: Record<string, boolean>
  visual?: OcrFields
}

const MAX_AGE_YEARS = 120

/**
 * Deterministic document checks: MRZ check digits, MRZ against the visual zone,
 * and dates that cannot happen.
 */
export class DocumentChecks {
  /**
   * Every issue found on the document. An empty list means nothing was provably wrong.
   *
   * @param input
   * @returns
   */
  static inspect(input: DocumentCheckInput): DocumentIssue[] {
    return [...DocumentChecks.mrz(input), ...DocumentChecks.dates(input.fields, input.now ?? new Date())]
  }

  private static mrz(input: DocumentCheckInput): DocumentIssue[] {
    const detail = DocumentChecks.mrzDetail(input.raw)
    if (!detail) return []

    const issues: DocumentIssue[] = []

    const failed = Object.entries(detail.checks ?? {})
      .filter(([, ok]) => ok === false)
      .map(([field]) => field)
    if (failed.length) issues.push({ code: 'mrz_check_digit', fields: failed })

    if (detail.visual) {
      const mismatched = (['documentNumber', 'dateOfBirth', 'expiryDate'] as const).filter((field) => {
        const mrz = input.fields[field]
        const visual = detail.visual![field]

        return !!mrz && !!visual && comparable(mrz) !== comparable(visual)
      })
      if (mismatched.length) issues.push({ code: 'mrz_visual_mismatch', fields: [...mismatched] })
    }

    return issues
  }

  private static dates(fields: OcrFields, now: Date): DocumentIssue[] {
    const issues: DocumentIssue[] = []
    const today = now.toISOString().slice(0, 10)
    const { dateOfBirth, issueDate, expiryDate } = fields

    if (issueDate && expiryDate && issueDate > expiryDate) {
      issues.push({ code: 'issue_after_expiry', fields: ['issueDate', 'expiryDate'] })
    }
    if (dateOfBirth && issueDate && dateOfBirth > issueDate) {
      issues.push({ code: 'birth_after_issue', fields: ['dateOfBirth', 'issueDate'] })
    }
    if (dateOfBirth && dateOfBirth > today) {
      issues.push({ code: 'birth_in_future', fields: ['dateOfBirth'] })
    }
    if (dateOfBirth && Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4)) > MAX_AGE_YEARS) {
      issues.push({ code: 'implausible_age', fields: ['dateOfBirth'] })
    }

    return issues
  }

  /** The MRZ parse detail, from a parser result or a driver payload that nests it. */
  private static mrzDetail(raw: unknown): MrzDetail | null {
    if (!raw || typeof raw !== 'object') return null

    const candidates = [raw, (raw as { parser?: unknown }).parser]
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && (candidate as MrzDetail).format === 'mrz') {
        return candidate as MrzDetail
      }
    }

    return null
  }
}

/**
 * Age in whole years on `on`, from an ISO date of birth.
 *
 * @param dateOfBirth
 * @param on
 * @returns
 */
export function ageOn(dateOfBirth: string, on: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth)
  if (!match) return null

  const today = on.toISOString().slice(0, 10)
  const years = Number(today.slice(0, 4)) - Number(match[1])
  const hadBirthday = today.slice(5) >= `${match[2]}-${match[3]}`

  return hadBirthday ? years : years - 1
}

const comparable = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '')
