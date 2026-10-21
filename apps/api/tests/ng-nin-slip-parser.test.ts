import { describe, expect, it } from 'vitest'
import { ngNinSlipParser } from '../src/app/services/providers/document-parsers'

// A Digital NIN Slip front as Tesseract reads it (synthetic values): labels and the surname are
// garbled, the NIN, dates and given names come through.
const DIGITAL_SLIP = `\\

a REPUBLIC OF miGERLA  [ESSARSFT
be Ne stm ro. r
; A. = i
0K1 PO i.

CHINEDJ, AMAKA NGA
03 Mar 1988 MALE oS
EE

Satiunst Mantifcation Sumter GEN
1234 567 8901`

const parse = (text: string) => ngNinSlipParser.parse({ text, country: 'NG', documentType: 'id_card' })

describe('ng-nin-slip parser', () => {
  it('reads the NIN, the birth date and the given names from a real Tesseract read', () => {
    const out = parse(DIGITAL_SLIP)

    expect(out?.fields).toMatchObject({
      documentNumber: '12345678901',
      dateOfBirth: '1988-03-03',
      firstName: 'Chinedj Amaka',
      nationality: 'NGA',
    })
    // The garbled surname line is not guessed at.
    expect(out?.fields.lastName).toBeUndefined()
  })

  it('reads the surname and the issue date from a clean read', () => {
    const out = parse(
      [
        'FEDERAL REPUBLIC OF NIGERIA',
        'DIGITAL NIN SLIP',
        'SURNAME/NOM',
        'EZE',
        'GIVEN NAMES/PRENOMS',
        'NGOZI, AMAKA NGA',
        'DATE OF BIRTH SEX/SEXE ISSUE DATE',
        '03 Mar 1988 MALE 14 Feb 2023',
        'National Identification Number (NIN)',
        '1234 567 8901',
      ].join('\n'),
    )

    expect(out?.fields).toEqual({
      documentNumber: '12345678901',
      dateOfBirth: '1988-03-03',
      issueDate: '2023-02-14',
      firstName: 'Ngozi Amaka',
      lastName: 'Eze',
      nationality: 'NGA',
    })
    expect(out?.confidence).toBe(0.8)
  })

  it('declines text that is not a NIN slip', () => {
    expect(parse('ROYAUME DE BELGIQUE\nCARTE D IDENTITE\n590-1234567-89')).toBeNull()
  })
})
