import type { DocumentParser } from '@arkyc/ocr'
import type { OcrFields } from '@arkyc/types'
import { countryOrUnknown, layoutConfidence, readDate, readName, textLines } from './shared'

/** The 19-character VIN, printed in groups of 4-4-4-4-3. */
const VIN = /\b([0-9A-Z]{4})\s?([0-9A-Z]{4})\s?([0-9A-Z]{4})\s?([0-9A-Z]{4})\s?([0-9A-Z]{3})\b/

/** Letters OCR reads in place of digits in a VIN; applied only when that makes it hexadecimal. */
const VIN_DIGITS: Record<string, string> = { O: '0', S: '5', I: '1', Z: '2' }

/**
 * The VIN, preferring the back's "FIRSTNAME:VIN" line (printed on a plain
 * background, so it OCRs more cleanly than the patterned front).
 */
function readVin(lines: string[]): string | undefined {
  const back = lines
    .find((line) => /^[A-Za-z'-]{2,}\s*:\s*[0-9A-Z]{4}\s/.test(line) && !/^(VIN|CODE|DELIM)\b/i.test(line))
    ?.replace(/^[^:]*:/, '')
  const front = lines.map((line) => line.match(/\bVIN\b[\s:|]*(.*)$/i)?.[1]).find(Boolean)

  for (const value of [back, front]) {
    const match = value?.replace(/\|/g, ' ').toUpperCase().match(VIN)

    if (!match) continue

    const vin = match.slice(1).join('')
    const hex = vin.replace(/[OSIZ]/g, (letter) => VIN_DIGITS[letter]!)

    return /^[0-9A-F]+$/.test(hex) ? hex : vin
  }

  return undefined
}

/**
 * The Nigerian INEC Permanent Voter Card. No MRZ. The front prints the VIN, the
 * holder as an unlabelled "SURNAME, GIVEN NAMES" line, then labelled date of
 * birth, gender, occupation and address; the back repeats the VIN and the
 * registration date. A serial number printed down the left edge puts a stray
 * character at the start of most OCR'd lines, so line matches allow one. Also
 * runs when no country was selected; the voter-card wording gates it.
 */
export const ngVoterCardParser: DocumentParser = countryOrUnknown(['NG', 'NGA'], {
  name: 'ng-voter-card',
  documentTypes: ['id_card'],
  parse: ({ text, lines: given }) => {
    if (!/VOTER|ELECTORAL|\bINEC\b|\bVIN\b/i.test(text)) return null

    const lines = textLines(text, given).map((line) => line.replace(/^\S\s+(?=\S{2})/, ''))
    const fields: OcrFields = { documentNumber: readVin(lines) }

    const holder = lines.map((line) => line.match(/^([A-Z][A-Z'-]+),\s*([A-Z][A-Z' -]+)$/)).find(Boolean)

    if (holder) {
      fields.lastName = readName(holder[1]!)
      fields.firstName = readName(holder[2]!)
    }

    const birth = lines.findIndex((line) => /DATE\s*OF\s*BIRTH/i.test(line))

    if (birth >= 0) fields.dateOfBirth = readDate(lines[birth]!, 'birth') ?? readDate(lines[birth + 1] ?? '', 'birth')
    // Registration is when the card's details were captured: the closest it has to an issue date.
    fields.issueDate = readDate(lines.find((line) => /DATE\s*OF\s*REG/i.test(line)) ?? '', 'issue')
    fields.nationality = 'NGA'

    for (const key of Object.keys(fields) as (keyof OcrFields)[]) {
      if (!fields[key]) delete fields[key]
    }
    if (!fields.documentNumber && !fields.dateOfBirth) return null

    return {
      fields,
      confidence: layoutConfidence(fields),
      raw: { layout: 'ng-voter-card' },
    }
  },
})
