import type { IsoDate, OcrFields } from '@arkyc/types'
import type { DocumentParser, ParseInput, ParseOutput } from './types'

/**
 * Parser for the ICAO 9303 Machine-Readable Zone (MRZ) found on passports (TD3),
 * ID/residence cards (TD1) and some visas (TD2). The MRZ is standardized across
 * countries, which makes this a strong default parser. Check digits are verified
 * to derive a confidence score.
 */

const FILLER = '<'

/** Numeric value of an MRZ character for check-digit computation. */
function charValue(ch: string): number {
  if (ch === FILLER) return 0
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55 // A=10 … Z=35
  return 0
}

/** ICAO 9303 check digit over a field (weights 7,3,1 repeating, mod 10). */
function checkDigit(field: string): number {
  const weights = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < field.length; i += 1) sum += charValue(field[i]!) * weights[i % 3]!
  return sum % 10
}

/** Whether `field`'s trailing check digit matches (`expected` is the digit char). */
function checkOk(field: string, expected: string): boolean {
  if (!/^[0-9]$/.test(expected)) return false
  return checkDigit(field) === Number(expected)
}

/** Convert an MRZ `YYMMDD` to ISO `YYYY-MM-DD`, or `undefined` if implausible. */
function mrzDate(yymmdd: string, kind: 'dob' | 'expiry'): IsoDate | undefined {
  if (!/^[0-9]{6}$/.test(yymmdd)) return undefined
  const yy = Number(yymmdd.slice(0, 2))
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return undefined
  // DOB is in the past; expiry is generally in the present/future.
  const pivot = 70
  const century = kind === 'dob' ? (yy > pivot ? 1900 : 2000) : yy < pivot ? 2000 : 1900
  return `${century + yy}-${mm}-${dd}` as IsoDate
}

/** Split an MRZ name field (`SURNAME<<GIVEN<NAMES`) into structured names. */
function parseNameField(field: string): Pick<OcrFields, 'firstName' | 'lastName' | 'fullName'> {
  const [surnameRaw = '', givenRaw = ''] = field.split('<<')
  const surname = surnameRaw.replace(/</g, ' ').trim()
  const given = givenRaw.replace(/</g, ' ').trim()
  const firstName = given.split(/\s+/)[0] || undefined
  const fullName = [given, surname].filter(Boolean).join(' ') || undefined
  return { firstName, lastName: surname || undefined, fullName }
}

/** Normalize raw OCR text into candidate MRZ lines (uppercase, MRZ charset). */
function mrzLines(input: ParseInput): string[] {
  const lines = input.lines ?? input.text.split(/\r?\n/)
  return lines
    .map((l) =>
      l
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9<]/g, ''),
    )
    .filter((l) => l.length >= 28 && /^[A-Z0-9<]+$/.test(l) && l.includes(FILLER))
}

/** A field's value with whether its check digit validated. */
interface Checked {
  value: string
  ok: boolean
}

function field(raw: string, expected: string): Checked {
  return { value: raw.replace(/</g, ''), ok: checkOk(raw, expected) }
}

function build(
  name: ReturnType<typeof parseNameField>,
  documentNumber: Checked,
  nationality: string,
  dob: { value: string; ok: boolean },
  expiry: { value: string; ok: boolean },
): ParseOutput {
  const fields: OcrFields = {
    ...name,
    documentNumber: documentNumber.value || undefined,
    nationality: nationality.replace(/</g, '') || undefined,
    dateOfBirth: mrzDate(dob.value, 'dob'),
    expiryDate: mrzDate(expiry.value, 'expiry'),
  }
  const checks = [documentNumber.ok, dob.ok, expiry.ok]
  const passed = checks.filter(Boolean).length
  const confidence = 0.5 + 0.5 * (passed / checks.length)
  return {
    fields,
    confidence,
    raw: { format: 'mrz', checks: { documentNumber: documentNumber.ok, dob: dob.ok, expiry: expiry.ok } },
  }
}

/** TD3 (passport): two 44-char lines. */
function parseTd3(l1: string, l2: string): ParseOutput {
  const name = parseNameField(l1.slice(5))
  const documentNumber = field(l2.slice(0, 9), l2[9]!)
  const nationality = l2.slice(10, 13)
  const dob = { value: l2.slice(13, 19), ok: checkOk(l2.slice(13, 19), l2[19]!) }
  const expiry = { value: l2.slice(21, 27), ok: checkOk(l2.slice(21, 27), l2[27]!) }
  return build(name, documentNumber, nationality, dob, expiry)
}

/** TD2: two 36-char lines. */
function parseTd2(l1: string, l2: string): ParseOutput {
  const name = parseNameField(l1.slice(5))
  const documentNumber = field(l2.slice(0, 9), l2[9]!)
  const nationality = l2.slice(10, 13)
  const dob = { value: l2.slice(13, 19), ok: checkOk(l2.slice(13, 19), l2[19]!) }
  const expiry = { value: l2.slice(21, 27), ok: checkOk(l2.slice(21, 27), l2[27]!) }
  return build(name, documentNumber, nationality, dob, expiry)
}

/** TD1 (ID card): three 30-char lines. */
function parseTd1(l1: string, l2: string, l3: string): ParseOutput {
  const documentNumber = field(l1.slice(5, 14), l1[14]!)
  const dob = { value: l2.slice(0, 6), ok: checkOk(l2.slice(0, 6), l2[6]!) }
  const expiry = { value: l2.slice(8, 14), ok: checkOk(l2.slice(8, 14), l2[14]!) }
  const nationality = l2.slice(15, 18)
  const name = parseNameField(l3)
  return build(name, documentNumber, nationality, dob, expiry)
}

class MrzParser implements DocumentParser {
  readonly name = 'mrz'

  parse(input: ParseInput): ParseOutput | null {
    const lines = mrzLines(input)
    if (lines.length < 2) return null

    // TD1: three ~30-char lines.
    const td1 = lines.filter((l) => l.length >= 28 && l.length <= 32)
    if (td1.length >= 3) return parseTd1(pad(td1[0]!, 30), pad(td1[1]!, 30), td1[2]!)

    // TD3: two ~44-char lines.
    const td3 = lines.filter((l) => l.length >= 42 && l.length <= 46)
    if (td3.length >= 2) return parseTd3(pad(td3[0]!, 44), pad(td3[1]!, 44))

    // TD2: two ~36-char lines.
    const td2 = lines.filter((l) => l.length >= 34 && l.length <= 38)
    if (td2.length >= 2) return parseTd2(pad(td2[0]!, 36), pad(td2[1]!, 36))

    return null
  }
}

function pad(line: string, len: number): string {
  return line.length >= len ? line : line + FILLER.repeat(len - line.length)
}

/** The MRZ parser — a country-agnostic default for machine-readable documents. */
export function mrzParser(): DocumentParser {
  return new MrzParser()
}
