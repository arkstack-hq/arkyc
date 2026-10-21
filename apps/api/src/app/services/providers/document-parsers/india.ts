import type { DocumentParser } from '@arkyc/ocr'
import type { OcrFields } from '@arkyc/types'
import { readLabelledFields } from './labelled'
import { layoutConfidence, readDate, readName, textLines } from './shared'

// Verhoeff tables (dihedral group D5), the check digit scheme of the Aadhaar number.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

/**
 * Whether a digit string passes the Verhoeff check (its last digit is the check digit).
 *
 * @param digits
 * @returns
 */
export function verhoeffValid(digits: string): boolean {
  let check = 0
  ;[...digits].reverse().forEach((digit, i) => {
    check = D[check]![P[i % 8]![Number(digit)]!]!
  })

  return check === 0
}

/**
 * The Indian Aadhaar card (and e-Aadhaar printout). No MRZ; the 12-digit number
 * prints grouped 4-4-4, never starts with 0 or 1, and ends in a Verhoeff check
 * digit, so an OCR misread is caught rather than stored. The holder's name sits
 * on the line above "DOB" (older cards print only a "Year of Birth", which is not
 * a date and is left empty).
 */
export const inAadhaarParser: DocumentParser = {
  name: 'in-aadhaar',
  countries: ['IN', 'IND'],
  documentTypes: ['id_card'],
  parse: ({ text, lines: given }) => {
    // Not part of a longer run of digit groups: the 16-digit VID prints alongside.
    const numbers = [...text.matchAll(/(?<!\d\s?)\b([2-9]\d{3})\s?(\d{4})\s?(\d{4})\b(?!\s?\d)/g)]
      .map((match) => `${match[1]}${match[2]}${match[3]}`)
      .filter(verhoeffValid)

    if (!numbers.length && !/aadhaar|uidai|unique\s*identification/i.test(text)) return null

    const lines = textLines(text, given)
    const fields: OcrFields = {}

    if (numbers[0]) fields.documentNumber = numbers[0]

    const dobIndex = lines.findIndex((line) => /\b(DOB|Date\s*of\s*Birth)\b/i.test(line))

    if (dobIndex >= 0) {
      fields.dateOfBirth = readDate(lines[dobIndex]!, 'birth')
      const name = lines[dobIndex - 1]
      if (name && !/government|india|aadhaar/i.test(name)) fields.fullName = readName(name)
    }

    for (const key of Object.keys(fields) as (keyof OcrFields)[]) {
      if (!fields[key]) delete fields[key]
    }

    if (!fields.documentNumber && !fields.dateOfBirth) return null

    return {
      fields,
      confidence: layoutConfidence(fields, fields.documentNumber ? 0.5 : 0.3),
      raw: { layout: 'in-aadhaar' },
    }
  },
}

/**
 * The Indian PAN card. The 10-character PAN is five letters (the fourth names the
 * holder type: P for a person), four digits and a letter. Newer cards label the
 * name and date of birth; older ones print, unlabelled under the header, the
 * holder's name, the father's name, then the date of birth.
 */
export const inPanParser: DocumentParser = {
  name: 'in-pan',
  countries: ['IN', 'IND'],
  documentTypes: ['id_card'],
  parse: ({ text, lines: given }) => {
    const pan = text.match(/\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/)?.[0]
    if (!pan) return null

    const labelled = readLabelledFields(text, given)
    const fields: OcrFields = {
      documentNumber: pan,
      fullName: labelled.fullName,
      dateOfBirth: labelled.dateOfBirth ?? readDate(text, 'birth'),
    }

    if (!fields.fullName) {
      // Older layout: the first name-like line after the header is the holder's.
      const lines = textLines(text, given)
      const header = lines.findIndex((line) => /income\s*tax|govt|government/i.test(line))
      const name = lines
        .slice(header + 1)
        .find((line) => /^[A-Z][A-Z .'-]+$/.test(line) && !/INDIA|DEPARTMENT|GOVT/.test(line))
      if (name) fields.fullName = readName(name)
    }

    for (const key of Object.keys(fields) as (keyof OcrFields)[]) {
      if (!fields[key]) delete fields[key]
    }

    return { fields, confidence: layoutConfidence(fields, 0.5), raw: { layout: 'in-pan' } }
  },
}
