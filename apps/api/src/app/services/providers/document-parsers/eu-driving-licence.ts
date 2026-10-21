import { layoutConfidence, readDate, readName } from './shared'

import type { DocumentParser } from '@arkyc/ocr'
import type { OcrFields } from '@arkyc/types'

/** EU member states, the EEA, the UK and Switzerland (alpha-2 and alpha-3). */
const COUNTRIES = [
  ['AT', 'AUT'],
  ['BE', 'BEL'],
  ['BG', 'BGR'],
  ['HR', 'HRV'],
  ['CY', 'CYP'],
  ['CZ', 'CZE'],
  ['DK', 'DNK'],
  ['EE', 'EST'],
  ['FI', 'FIN'],
  ['FR', 'FRA'],
  ['DE', 'DEU'],
  ['GR', 'GRC'],
  ['HU', 'HUN'],
  ['IE', 'IRL'],
  ['IT', 'ITA'],
  ['LV', 'LVA'],
  ['LT', 'LTU'],
  ['LU', 'LUX'],
  ['MT', 'MLT'],
  ['NL', 'NLD'],
  ['PL', 'POL'],
  ['PT', 'PRT'],
  ['RO', 'ROU'],
  ['SK', 'SVK'],
  ['SI', 'SVN'],
  ['ES', 'ESP'],
  ['SE', 'SWE'],
  ['IS', 'ISL'],
  ['LI', 'LIE'],
  ['NO', 'NOR'],
  ['GB', 'GBR', 'UK'],
  ['CH', 'CHE'],
].flat()

type Field = '1' | '2' | '3' | '4a' | '4b' | '5'

/**
 * The numbered field markers, with the misreads OCR makes of them on real cards:
 * "4a." read as "42.", "4b." as "45.", "1." as "i." or "l.".
 */
const MARKERS: [Field, string][] = [
  ['4a', '4[a2]'],
  ['4b', '4[b56h]'],
  ['1', '[1lIi|]'],
  ['2', '2'],
  ['3', '3'],
  ['5', '[5S]'],
]

const MARKER = new RegExp(
  `(?:^|(?<=[\\s|]))(${MARKERS.map(([, pattern]) => pattern).join('|')}|4[cd])[.,](?=\\s|\\d)`,
  'gm',
)

function fieldOf(marker: string): Field | null {
  for (const [field, pattern] of MARKERS) {
    if (new RegExp(`^${pattern}$`).test(marker)) return field
  }

  return null
}

/**
 * A name value without the OCR noise that trails it on a card ("Mustermann BE i |",
 * "JAN 5 A hy"): cut at a bar and drop trailing short words whose case doesn't
 * match the name's own.
 */
function cleanName(value: string): string | undefined {
  const words = value.split('|')[0]!.trim().split(/\s+/)
  const upper = words[0] === words[0]?.toUpperCase()
  while (words.length > 1) {
    const last = words[words.length - 1]!
    const letters = last.replace(/[^\p{L}]/gu, '')
    if (letters.length > 2 && /^[\p{L}'-]+$/u.test(last)) break
    if (letters.length === 2 && upper && last === last.toUpperCase() && /^\p{L}+$/u.test(last)) break
    words.pop()
  }

  return readName(words.join(' '))
}

/**
 * The EU-format driving licence (Directive 2006/126/EC), also issued by the EEA
 * states, the UK and Switzerland. No MRZ, but every field is numbered, the same
 * in every country and language: 1 surname, 2 given names, 3 date and place of
 * birth, 4a issue date, 4b expiry date, 4c issuing authority, 5 licence number.
 */
export const euDrivingLicenceParser: DocumentParser = {
  name: 'eu-driving-licence',
  countries: COUNTRIES,
  documentTypes: ['drivers_license'],
  parse: ({ text }) => {
    // Each value runs from its marker to the next marker or the end of the line.
    const values = new Map<Field, string>()
    for (const line of text.split(/\r?\n/)) {
      const marks = [...line.matchAll(MARKER)]
      marks.forEach((mark, i) => {
        const field = fieldOf(mark[1]!)
        if (!field || values.has(field)) return
        const end = marks[i + 1]?.index ?? line.length
        const value = line.slice(mark.index! + mark[0].length, end).trim()
        if (value) values.set(field, value)
      })
    }
    if (values.size < 2) return null

    const fields: OcrFields = {}
    const surname = values.get('1')
    const given = values.get('2')

    if (surname) fields.lastName = cleanName(surname)
    if (given) fields.firstName = cleanName(given)

    fields.dateOfBirth = readDate(values.get('3') ?? '', 'birth')
    fields.issueDate = readDate(values.get('4a') ?? '', 'issue')
    fields.expiryDate = readDate(values.get('4b') ?? '', 'expiry')
    const number = values.get('5')?.match(/[A-Z0-9]*\d[A-Z0-9]*/)?.[0]

    if (number && number.length >= 5) fields.documentNumber = number

    for (const key of Object.keys(fields) as (keyof OcrFields)[]) {
      if (!fields[key]) delete fields[key]
    }

    // Two stray markers aren't a licence: it must also have yielded a date or the number.
    if (!fields.dateOfBirth && !fields.issueDate && !fields.expiryDate && !fields.documentNumber) return null

    return {
      fields,
      confidence: layoutConfidence(fields),
      raw: { layout: 'eu-driving-licence' },
    }
  },
}
