import type { DocumentParser } from '@arkyc/ocr'
import type { OcrFields } from '@arkyc/types'
import { countryOrUnknown, readDate, readName, textLines } from './shared'

/**
 * The Nigerian NIMC NIN slip (the "Digital NIN Slip" card and the printed slip).
 * It has no MRZ, and its front prints, in order: surname, given names
 * ("FIRST, MIDDLE", followed by the nationality code), date of birth with sex,
 * issue date, and the 11-digit NIN grouped 4-3-4.
 *
 * The NIN and the date of birth are read reliably; names are read from the line
 * shapes and labels, since OCR often garbles the small labels above them. It
 * also runs when no country was selected, so its own check must recognise the
 * slip: the NIN's grouping or the slip's wording, not just any ID's.
 */
export const ngNinSlipParser: DocumentParser = countryOrUnknown(['NG', 'NGA'], {
  name: 'ng-nin-slip',
  documentTypes: ['id_card'],
  parse: ({ text, lines: given }) => {
    // OCR often garbles the slip's labels, so the NIN's 4-3-4 grouping also marks it.
    const grouped = /(?<![\d/.-])\d{4} \d{3} \d{4}(?![\d/.-])/.test(text)

    if (!grouped && !/\bNIN\b|NIMC|Nigeria|National\s+Identification\s+Num/i.test(text)) return null

    const lines = textLines(text, given)
    const fields: OcrFields = {}

    // The NIN: 11 digits, usually grouped 4-3-4. Never part of a date.
    const nin = text.match(/(?<![\d/.-])(\d{4})\s?(\d{3})\s?(\d{4})(?![\d/.-])/)

    if (nin) fields.documentNumber = `${nin[1]}${nin[2]}${nin[3]}`

    // Dates print as "03 Mar 1988". The date of birth sits next to the sex; the
    // issue date is labelled. Otherwise the earliest date is the date of birth.
    const dates = [...text.matchAll(/\b(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})\b(?=(.{0,12}))/g)]
      .map((match) => ({ iso: readDate(match[1]!, 'birth'), sexNext: /\b(MALE|FEMALE|[MF])\b/i.test(match[2]!) }))
      .filter((date) => date.iso)

    const birth = dates.find((date) => date.sexNext) ?? [...dates].sort((a, b) => a.iso!.localeCompare(b.iso!))[0]

    if (birth) fields.dateOfBirth = birth.iso

    const issue = dates.find((date) => date !== birth && date.iso! > birth!.iso!)

    if (issue) fields.issueDate = issue.iso

    // Given names print as "FIRST, MIDDLE" in capitals with the nationality code
    // after them. OCR can put stray marks before them ("| bt NGOZI, AMAKA").
    const GIVEN = /\b([A-Z][A-Z'-]{1,},\s*[A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+)*)/
    const givenIndex = lines.findIndex((line) => GIVEN.test(line))

    if (givenIndex >= 0) {
      fields.firstName = readName(lines[givenIndex]!.match(GIVEN)![1]!.replace(/\bNGA\b.*$/, ''))

      // The surname is the nearest line above that OCR read as one clean word
      // (skipping the field labels).
      const surname = lines
        .slice(0, givenIndex)
        .reverse()
        .find((line) => !/NAME|NOM/i.test(line))
        ?.match(/^([A-Z][A-Z'-]+)$/)?.[1]

      if (surname) fields.lastName = readName(surname)
    }

    if (/\bNGA\b|Nigeria/i.test(text)) fields.nationality = 'NGA'

    if (!fields.documentNumber && !fields.dateOfBirth) return null

    const read = [fields.documentNumber, fields.dateOfBirth, fields.firstName, fields.lastName].filter(Boolean).length

    return {
      fields,
      confidence: Number((0.4 + read * 0.1).toFixed(2)),
      raw: { layout: 'ng-nin-slip' },
    }
  },
})
