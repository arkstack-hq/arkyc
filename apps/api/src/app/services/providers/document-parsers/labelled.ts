import type { DocumentParser } from '@arkyc/ocr'
import type { OcrFields } from '@arkyc/types'
import { DATE_PATTERN, type DateKind, readDate, readName, textLines } from './shared'

type LabelledField =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'dateOfBirth'
  | 'issueDate'
  | 'expiryDate'
  | 'documentNumber'

/**
 * Printed labels, English and French, most specific first. Each must start a
 * line or follow a separator, so "Name" inside "Surname" never matches.
 */
const LABELS: [LabelledField, RegExp][] = [
  ['firstName', /(?:given\s*names?|first\s*names?|fore\s*names?|other\s*names?|pr[ée]noms?)\b/iy],
  ['lastName', /(?:surname|last\s*name|family\s*name|nom\b(?!\s*complet))/iy],
  ['fullName', /(?:full\s*name|nom\s*complet|names?)\b/iy],
  [
    'dateOfBirth',
    /(?:date\s*of\s*birth|birth\s*date|d\s*\.?\s*o\s*\.?\s*b\b\.?|date\s*de\s*naissance|n[ée]\s*\(?e?\)?\s*le)/iy,
  ],
  [
    'issueDate',
    /(?:date\s*of\s*issue|issue\s*date|issued(?:\s*on)?|iss\b\.?|date\s*de\s*d[ée]livrance|d[ée]livr[ée]\s*le)/iy,
  ],
  [
    'expiryDate',
    /(?:date\s*of\s*expiry|expiry(?:\s*date)?|expiration(?:\s*date)?|expires|valid\s*(?:until|thru|to)|exp\b\.?|date\s*d'?expiration)/iy,
  ],
  [
    'documentNumber',
    /(?:licen[cs]e\s*(?:no|number|#)|l\s*\/\s*no|id\s*(?:no|number|#)|card\s*(?:no|number)|document\s*(?:no|number)|national\s*id(?:entification)?\s*(?:no|number)|personal\s*(?:no|number)|vin|nin)\b\.?/iy,
  ],
]

const DATE_KINDS: Partial<Record<LabelledField, DateKind>> = {
  dateOfBirth: 'birth',
  issueDate: 'issue',
  expiryDate: 'expiry',
}

/** Lines naming someone other than the holder ("Father's Name", "Next of kin"). */
const OTHER_PERSON = /father|mother|spouse|husband|wife|guardian|kin|parent|p[èe]re|m[èe]re/i

interface Found {
  field: LabelledField
  start: number
  end: number
}

/** Every label on a line, left to right. */
function labelsIn(line: string): Found[] {
  const found: Found[] = []

  for (let at = 0; at < line.length; at++) {
    if (at > 0 && !/[\s/|:,;]/.test(line[at - 1]!)) continue
    for (const [field, pattern] of LABELS) {
      pattern.lastIndex = at
      const match = pattern.exec(line)

      if (match) {
        const previous = found[found.length - 1]

        // A bilingual label ("SURNAME/NOM", "GIVEN NAMES/PRÉNOMS") is one label.
        if (previous?.field === field && /^[\s/]*$/.test(line.slice(previous.end, at))) {
          previous.end = at + match[0].length
        } else {
          found.push({ field, start: at, end: at + match[0].length })
        }
        at += match[0].length - 1
        break
      }
    }
  }

  return found
}

/** The value text after a label: drops a second-language label ("SURNAME/NOM") and separators. */
function afterLabel(value: string): string {
  return value
    .replace(/^\s*\/\s*[\p{L}' ]+?(?=[:\s]|$)/u, '')
    .replace(/^[\s:.\-|=]+/, '')
    .trim()
}

/** A document number from a value: a 4-4-4-style group, or the first token with a digit. */
function readNumber(value: string): string | undefined {
  const grouped = value.match(/^[A-Z0-9]{3,5}(?:\s[A-Z0-9]{3,5}){1,5}\b/i)?.[0]

  if (grouped && /\d/.test(grouped)) return grouped.replace(/\s/g, '').toUpperCase()

  const token = value.match(/[A-Z0-9-]*\d[A-Z0-9-]*/i)?.[0]

  return token && token.replace(/-/g, '').length >= 5 ? token.toUpperCase() : undefined
}

function readValue(field: LabelledField, value: string): string | undefined {
  const kind = DATE_KINDS[field]

  if (kind) return readDate(value, kind)

  if (field === 'documentNumber') return readNumber(value)

  // A name value must not itself be (or start with) another label.
  if (labelsIn(value).some((label) => label.start === 0)) return undefined

  return readName(value)
}

/**
 * Read labelled fields from OCR lines. A label's value is the rest of its line,
 * or the next line when the label stands alone (or heads a row of labels whose
 * values print beneath them, matched up in order).
 *
 * @param text
 * @param given
 * @returns
 */
export function readLabelledFields(text: string, given?: string[]): OcrFields {
  const lines = textLines(text, given)
  const fields: OcrFields = {}
  const set = (field: LabelledField, value: string | undefined) => {
    if (value && !fields[field]) fields[field] = value
  }

  lines.forEach((line, index) => {
    if (OTHER_PERSON.test(line)) return
    const labels = labelsIn(line)

    if (!labels.length) return
    const next = lines[index + 1] ?? ''

    // A header row of several labels ("Date of Birth  Sex  Issue Date") with the
    // values on the next line: hand out that line's dates in label order.
    const inline = labels.map((label, i) => afterLabel(line.slice(label.end, labels[i + 1]?.start ?? line.length)))

    if (labels.length > 1 && inline.every((value) => !/\d/.test(value))) {
      const dates = [...next.matchAll(new RegExp(DATE_PATTERN, 'g'))].map((match) => match[0])

      labels
        .filter((label) => DATE_KINDS[label.field])
        .forEach((label, i) => set(label.field, dates[i] ? readValue(label.field, dates[i]!) : undefined))

      return
    }

    labels.forEach((label, i) => {
      set(
        label.field,
        readValue(label.field, inline[i]!) ?? (labels.length === 1 ? readValue(label.field, next) : undefined),
      )
    })
  })

  return fields
}

/**
 * Any card that prints English or French field labels and has no MRZ: the
 * Nigerian driving licence and voter's card, most Commonwealth national IDs,
 * francophone cartes d'identité. Tried after every layout-specific parser and
 * before the generic scraper, for any country or document type.
 */
export const labelledFieldParser: DocumentParser = {
  name: 'labelled-fields',
  parse: ({ text, lines }) => {
    const fields = readLabelledFields(text, lines)
    const read = Object.values(fields).filter(Boolean).length

    if (read < 2) return null

    return {
      fields,
      confidence: Math.min(0.6, Number((0.3 + read * 0.05).toFixed(2))),
      raw: { layout: 'labelled-fields' },
    }
  },
}
