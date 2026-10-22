import type { DocumentParser } from '@arkyc/ocr'
import type { IsoDate, OcrFields } from '@arkyc/types'

/**
 * Helpers shared by the document parsers: OCR text is noisy, so dates and names
 * are normalised here once rather than in every layout.
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

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** What a date is, which decides the century of a two-digit year. */
export type DateKind = 'birth' | 'issue' | 'expiry'

/**
 * Expand a two-digit year. A birth or issue date is never in the future, so
 * "64" is 1964 and "15" is 2015; an expiry is always 20yy.
 */
function fullYear(year: number, kind: DateKind): number {
  if (year >= 100) return year

  if (kind === 'expiry') return 2000 + year

  return 2000 + year > new Date().getFullYear() ? 1900 + year : 2000 + year
}

function iso(year: number, month: number, day: number): IsoDate | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return undefined

  return `${year}-${pad2(month)}-${pad2(day)}` as IsoDate
}

/**
 * Matches one printed date: "12.08.64", "07/04/1964", "19 Jul 1994", "1964-04-07", "AUG 09,2017".
 */
export const DATE_PATTERN =
  /\b(?:(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})|(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]+(\d{4})|(\d{4})-(\d{2})-(\d{2})|([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4}))\b/

/**
 * The first date in `text`, day-first (as printed outside the US), or undefined.
 *
 * @param text
 * @param kind
 * @returns
 */
export function readDate(text: string, kind: DateKind): IsoDate | undefined {
  const match = text.match(DATE_PATTERN)

  if (!match) return undefined

  if (match[1]) return iso(fullYear(Number(match[3]), kind), Number(match[2]), Number(match[1]))

  if (match[4]) {
    const month = MONTHS[match[5]!.slice(0, 3).toLowerCase()]

    return month ? iso(Number(match[6]), month, Number(match[4])) : undefined
  }

  if (match[7]) return iso(Number(match[7]), Number(match[8]), Number(match[9]))

  const month = MONTHS[match[10]!.slice(0, 3).toLowerCase()]

  return month ? iso(Number(match[12]), month, Number(match[11])) : undefined
}

/**
 * Digits OCR commonly reads in place of letters inside a name.
 */
const NAME_DIGITS: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B' }

/**
 * Title-cased name words from an OCR'd value: "KOWALSK1" → "Kowalski",
 * "NGOZI, AMAKA" → "Ngozi Amaka". Tokens that aren't plausibly name words
 * (mostly digits or symbols, single letters) are dropped; undefined when
 * nothing is left.
 *
 * @param text
 * @returns
 */
export function readName(text: string): string | undefined {
  const words = text
    .split(/[\s,]+/)
    .map((word) => word.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, ''))
    .filter((word) => (word.match(/\p{L}/gu)?.length ?? 0) >= Math.max(2, word.length - 1))
    .map((word) => word.replace(/\d/g, (digit) => NAME_DIGITS[digit] ?? digit))
    .filter((word) => /^[\p{L}'-]{2,}$/u.test(word))
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase())

  return words.length ? words.join(' ') : undefined
}

/**
 * Confidence for a layout parse: a base for recognising the layout plus a step per field read.
 *
 * @param fields
 * @param base
 * @returns
 */
export function layoutConfidence(fields: OcrFields, base = 0.4): number {
  const read = Object.values(fields).filter(Boolean).length

  return Math.min(0.85, Number((base + read * 0.08).toFixed(2)))
}

/**
 * Split OCR text into trimmed, non-empty lines.
 *
 * @param text
 * @param given
 * @returns
 */
export function textLines(text: string, given?: string[]): string[] {
  return (given ?? text.split(/\r?\n/)).map((line) => line.trim()).filter(Boolean)
}

/**
 * Scope a parser to its countries while still running it when no country was
 * selected (the widget doesn't always ask). The registry skips a country-scoped
 * parser whenever the country is missing, so the scope moves into `parse`: a
 * named other country is declined, a missing one is allowed, and the parser's
 * own layout check decides the rest.
 */
export function countryOrUnknown(countries: string[], parser: DocumentParser): DocumentParser {
  const allowed = countries.map((country) => country.toUpperCase())

  return {
    ...parser,
    countries: undefined,
    parse: (input) =>
      input.country && !allowed.includes(input.country.trim().toUpperCase()) ? null : parser.parse(input),
  }
}
