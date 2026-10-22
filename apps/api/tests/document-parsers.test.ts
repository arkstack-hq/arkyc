import { describe, expect, it } from 'vitest'
import { createDocumentParserRegistry } from '@arkyc/ocr'
import {
  documentParsers,
  euDrivingLicenceParser,
  inAadhaarParser,
  inPanParser,
  labelledFieldParser,
  ngVoterCardParser,
} from '../src/app/services/providers/document-parsers'
import { verhoeffValid } from '../src/app/services/providers/document-parsers/india'
import { readDate, readName } from '../src/app/services/providers/document-parsers/shared'

// OCR inputs below are Tesseract's actual reads of public specimen documents
// (fictional holders) or synthetic text. Never real people's documents.

describe('shared readers', () => {
  it('reads day-first dates in every printed form', () => {
    expect(readDate('3. 07.04.1964 WARSZAWA', 'birth')).toBe('1964-04-07')
    expect(readDate('12.08.64 Berlin', 'birth')).toBe('1964-08-12')
    expect(readDate('22.01.15', 'issue')).toBe('2015-01-22')
    expect(readDate('18.01.28', 'expiry')).toBe('2028-01-18')
    expect(readDate('03 Mar 1988 MALE', 'birth')).toBe('1988-03-03')
    expect(readDate('DOB: 14/02/1990', 'birth')).toBe('1990-02-14')
    expect(readDate('31.02.1990', 'birth')).toBe('1990-02-31') // shape-only: not calendar-checked
    expect(readDate('DATE OF REG.: MAR 14,2015', 'issue')).toBe('2015-03-14')
    expect(readDate('45.13.2020', 'birth')).toBeUndefined()
  })

  it('cleans OCR noise out of names', () => {
    expect(readName('KOWALSK1')).toBe('Kowalski')
    expect(readName('NGOZI, AMAKA')).toBe('Ngozi Amaka')
    expect(readName('= 123 ;')).toBeUndefined()
  })
})

describe('eu-driving-licence', () => {
  const parse = (text: string, country = 'DE') =>
    euDrivingLicenceParser.parse({ text, country, documentType: 'drivers_license' })

  it('reads the German specimen (two-digit years, "4a." read as "42.")', () => {
    const out = parse(`BREE FUHRERSCHEIN BUNDESREPUBLIK DEUTSCHLAND
Wee oN | Mustermann BE i |
2. Erika po z= Fp
Z A 3. 12.08.64 Berlin - 7
(1 iN 42.22.01.15 4c Landratsamt
he” Nig Musterhausen am See`)

    expect(out?.fields).toEqual({ firstName: 'Erika', dateOfBirth: '1964-08-12', issueDate: '2015-01-22' })
  })

  it('reads the Polish specimen ("1" read inside the surname, "4b." read as "45.")', () => {
    const out = parse(
      `: PRAWO JAZDY RZECZFO: LITA
PL ee Osta
1. KOWALSK1
2. JAN 5 A hy
3. 07.04.1964 WARSZAWA»
42.06.03.2019 oe
45.18.01.2028`,
      'PL',
    )

    expect(out?.fields).toEqual({
      lastName: 'Kowalski',
      firstName: 'Jan',
      dateOfBirth: '1964-04-07',
      issueDate: '2019-03-06',
      expiryDate: '2028-01-18',
    })
  })

  it('reads a clean UK licence, including the licence number', () => {
    const out = parse(
      `DRIVING LICENCE UK
1. MORGAN
2. SARAH MEREDITH
3. 11.03.1976 UNITED KINGDOM
4a. 19.01.2013 4b. 18.01.2023 4c. DVLA
5. MORGA753116SM9IJ 35`,
      'GB',
    )

    expect(out?.fields).toEqual({
      lastName: 'Morgan',
      firstName: 'Sarah Meredith',
      dateOfBirth: '1976-03-11',
      issueDate: '2013-01-19',
      expiryDate: '2023-01-18',
      documentNumber: 'MORGA753116SM9IJ',
    })
    expect(out?.confidence).toBeGreaterThan(0.8)
  })

  it('declines text with stray numbers but no licence fields', () => {
    expect(parse('1. Introduction\n2. Scope')).toBeNull()
  })
})

describe('labelled-fields', () => {
  const parse = (text: string) => labelledFieldParser.parse({ text })

  it('reads a Nigerian driving licence by its labels', () => {
    const out = parse(`FEDERAL REPUBLIC OF NIGERIA
NATIONAL DRIVERS LICENCE
L/NO: KJA12345AA01
NAME: EZE NGOZI AMAKA
D.O.B: 03-03-1988  SEX: F
ISS: 14-02-2023
EXP: 13-02-2028`)

    expect(out?.fields).toEqual({
      documentNumber: 'KJA12345AA01',
      fullName: 'Eze Ngozi Amaka',
      dateOfBirth: '1988-03-03',
      issueDate: '2023-02-14',
      expiryDate: '2028-02-13',
    })
  })

  it('reads a voter card number printed in groups', () => {
    const out = parse(`INDEPENDENT NATIONAL ELECTORAL COMMISSION
VIN 1A2B 3C4D 5E6F 7A8B 9C0
NAME EZE NGOZI
DATE OF BIRTH 03/03/1988`)

    expect(out?.fields).toMatchObject({ documentNumber: '1A2B3C4D5E6F7A8B9C0', fullName: 'Eze Ngozi' })
  })

  it('reads bilingual labels with values on the next line', () => {
    const out = parse(`SURNAME/NOM
EZE
GIVEN NAMES/PRÉNOMS
NGOZI AMAKA
DATE OF BIRTH SEX/SEXE ISSUE DATE
03 Mar 1988 F 14 Feb 2023`)

    expect(out?.fields).toEqual({
      lastName: 'Eze',
      firstName: 'Ngozi Amaka',
      dateOfBirth: '1988-03-03',
      issueDate: '2023-02-14',
    })
  })

  it('reads a French carte d’identité and skips other people’s names', () => {
    const out = parse(`CARTE NATIONALE D'IDENTITÉ
Nom: DUPONT
Prénoms: MARIE CLAIRE
Né(e) le: 01.02.1985
Nom du père: JEAN DUPONT`)

    expect(out?.fields).toEqual({ lastName: 'Dupont', firstName: 'Marie Claire', dateOfBirth: '1985-02-01' })
  })

  it('needs at least two fields', () => {
    expect(parse('Name: somebody')).toBeNull()
  })
})

describe('india', () => {
  it('validates the Aadhaar check digit', () => {
    expect(verhoeffValid('234123456783')).toBe(true)
    expect(verhoeffValid('234123456784')).toBe(false)
  })

  it('reads an Aadhaar card, ignoring a misread number and the VID', () => {
    const out = inAadhaarParser.parse({
      text: `Government of India
Ngozi Eze
DOB: 03/03/1988
FEMALE
2341 2345 6783
VID : 9134 5678 9012 3456`,
      country: 'IN',
      documentType: 'id_card',
    })

    expect(out?.fields).toEqual({ fullName: 'Ngozi Eze', dateOfBirth: '1988-03-03', documentNumber: '234123456783' })
    // One digit off fails the checksum, so it isn't stored.
    expect(
      inAadhaarParser.parse({ text: 'Government of India\n2341 2345 6784', country: 'IN', documentType: 'id_card' }),
    ).toBeNull()
  })

  it('reads a PAN card in both layouts', () => {
    const labelled = inPanParser.parse({
      text: `INCOME TAX DEPARTMENT GOVT. OF INDIA
Permanent Account Number Card
ABCPE1234F
Name
NGOZI EZE
Father's Name
CHIDI EZE
Date of Birth
03/03/1988`,
    })

    expect(labelled?.fields).toEqual({ documentNumber: 'ABCPE1234F', fullName: 'Ngozi Eze', dateOfBirth: '1988-03-03' })

    const older = inPanParser.parse({
      text: `INCOME TAX DEPARTMENT GOVT. OF INDIA
NGOZI EZE
CHIDI EZE
03/03/1988
Permanent Account Number
ABCPE1234F`,
    })

    expect(older?.fields).toEqual({ documentNumber: 'ABCPE1234F', fullName: 'Ngozi Eze', dateOfBirth: '1988-03-03' })
  })
})

describe('parser registry order', () => {
  const registry = createDocumentParserRegistry()

  for (const parser of documentParsers) registry.register(parser)

  it('prefers the layout parser, and falls back to labels for unknown layouts', () => {
    const licence = registry.parse({
      text: '1. MORGAN\n2. SARAH\n3. 11.03.1976 UNITED KINGDOM',
      country: 'GB',
      documentType: 'drivers_license',
    })

    expect(licence.raw).toMatchObject({ parser: 'eu-driving-licence' })

    const kenyan = registry.parse({
      text: 'REPUBLIC OF KENYA\nFULL NAMES\nNGOZI AMAKA EZE\nDATE OF BIRTH\n03.03.1988\nID NUMBER 12345678',
      country: 'KE',
      documentType: 'id_card',
    })

    expect(kenyan.raw).toMatchObject({ parser: 'labelled-fields' })
    expect(kenyan.fields).toMatchObject({ fullName: 'Ngozi Amaka Eze', documentNumber: '12345678' })
  })
})

describe('ng-voter-card', () => {
  // Synthetic values in the layout Tesseract produces for a real card: a stray
  // character from the edge serial starts most lines, a bar follows "VIN:", and
  // one VIN group is misread differently on each side ("8E50" as "BES0"/"8ES0").
  const NOISY = `«8 FEDERAL REPUBLIC OF MIGERIA 6)
Al INDEPENDENT MATIONAL ELECTORAY COMMISSION
: o- VOTER'S CARD
CODE:  24-11-03-012 VIN: | 7C2A D0E1 BES0 5F60 217
A DEUIM; ANAMBRA | IDEMILI NORTH
3 OGIDI Il
1 OKONKWO, ADA NNEKA
6 DATE OF BIRTH GENDER! ®
9 15-06-1990 FEMALE
1 OCCUPATION
J) TRADER
5 ADDRESS N
4 7 MARKET ROAD, OGIDI B:
ADA:7C2A D0E1 8ES0 5F60 217
Sy ZL DATE OF REG.: MAR 14,2015
A) BATCH. A10106/081006/08 | SERIAL NO.. 12345678`

  const parse = (text: string) => ngVoterCardParser.parse({ text, country: 'NG', documentType: 'id_card' })

  it('reads every field, taking the VIN from the cleaner back', () => {
    const out = parse(NOISY)

    expect(out?.fields).toEqual({
      documentNumber: '7C2AD0E18E505F60217',
      lastName: 'Okonkwo',
      firstName: 'Ada Nneka',
      dateOfBirth: '1990-06-15',
      issueDate: '2015-03-14',
      nationality: 'NGA',
    })
  })

  it('falls back to the front VIN when the back was not captured', () => {
    const front = NOISY.split('\nADA:')[0]!

    expect(parse(front)?.fields.documentNumber).toBe('7C2AD0E1BE505F60217')
  })

  it('wins over the NIN slip and labelled parsers in the registry', () => {
    const registry = createDocumentParserRegistry()

    for (const parser of documentParsers) registry.register(parser)

    expect(registry.parse({ text: NOISY, country: 'NG', documentType: 'id_card' }).raw).toMatchObject({
      parser: 'ng-voter-card',
    })
  })

  it('declines a document that is not a voter card', () => {
    expect(parse('FEDERAL REPUBLIC OF NIGERIA\nDIGITAL NIN SLIP\n1234 567 8901')).toBeNull()
  })
})
