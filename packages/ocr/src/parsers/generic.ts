import type { IsoDate, OcrFields } from '@arkyc/types'
import type { DocumentParser, ParseInput, ParseOutput } from './types'

/**
 * A best-effort parser for documents without (or with an unreadable) MRZ. It
 * scrapes dates and a document-number-like token from the raw OCR text via
 * regex. Low confidence by design — it's the last resort when the MRZ parser
 * can't read a machine-readable zone (most ID/licence fronts).
 */

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

function isoDate(y: number, m: number, d: number): IsoDate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null
  return `${y}-${pad2(m)}-${pad2(d)}` as IsoDate
}

/** Extract plausible calendar dates from text, ascending and de-duplicated. */
function extractDates(text: string): IsoDate[] {
  const found = new Set<IsoDate>()

  // ISO-ish: YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
  for (const m of text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const iso = isoDate(Number(m[1]), Number(m[2]), Number(m[3]))
    if (iso) found.add(iso)
  }
  // Day/Month first: DD-MM-YYYY / DD.MM.YYYY / DD/MM/YYYY (US MM/DD/YYYY when month>12).
  for (const m of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g)) {
    const a = Number(m[1])
    const b = Number(m[2])
    const y = Number(m[3])
    const iso = b > 12 ? isoDate(y, a, b) : isoDate(y, b, a)
    if (iso) found.add(iso)
  }
  // DD MON YYYY: "12 JAN 2020", "12-Jan-2020"
  for (const m of text.matchAll(/\b(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})\b/g)) {
    const month = MONTHS[m[2]!.slice(0, 3).toLowerCase()]
    if (month) {
      const iso = isoDate(Number(m[3]), month, Number(m[1]))
      if (iso) found.add(iso)
    }
  }

  return [...found].sort()
}

/** Pick a document-number-like token: 6–12 chars, has a digit, prefer alphanumeric. */
function extractDocumentNumber(text: string): string | undefined {
  const tokens = (text.toUpperCase().match(/\b[A-Z0-9]{6,12}\b/g) ?? []).filter(
    (t) => /[0-9]/.test(t) && !/^(19|20)\d{2}$/.test(t),
  )
  return tokens.find((t) => /[A-Z]/.test(t)) ?? tokens[0]
}

class GenericTextParser implements DocumentParser {
  readonly name = 'generic'

  parse(input: ParseInput): ParseOutput | null {
    const text = input.lines ? input.lines.join('\n') : input.text
    const dates = extractDates(text)
    const documentNumber = extractDocumentNumber(text)

    if (dates.length === 0 && !documentNumber) return null

    const fields: OcrFields = {}
    if (documentNumber) fields.documentNumber = documentNumber
    // Earliest date is most likely the date of birth; latest the expiry.
    if (dates.length >= 1) fields.dateOfBirth = dates[0]
    if (dates.length >= 2) fields.expiryDate = dates[dates.length - 1]

    return { fields, confidence: 0.35, raw: { format: 'generic', dates, documentNumber } }
  }
}

/** The generic best-effort text parser. */
export function genericTextParser(): DocumentParser {
  return new GenericTextParser()
}
