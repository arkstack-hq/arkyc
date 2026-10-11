import { describe, expect, it } from 'vitest'
import { DocumentChecks, ageOn, createDocumentParserRegistry, type DocumentParser } from '../src/index'

const TD3 = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'].join('\n')
const now = new Date('2026-10-11T00:00:00Z')

const visualParser = (documentNumber: string): DocumentParser => ({
  name: 'uto-visual',
  countries: ['UTO'],
  parse: () => ({ fields: { documentNumber, dateOfBirth: '1974-08-12' }, confidence: 0.8 }),
})

describe('DocumentChecks', () => {
  it('passes a valid MRZ that agrees with its visual zone', () => {
    const registry = createDocumentParserRegistry().register(visualParser('L898902C3'))
    const parsed = registry.parse({ text: TD3, country: 'UTO' })

    expect(DocumentChecks.inspect({ ...parsed, now })).toEqual([])
  })

  it('flags an MRZ whose visual zone disagrees', () => {
    const registry = createDocumentParserRegistry().register(visualParser('X1234567'))
    const parsed = registry.parse({ text: TD3, country: 'UTO' })

    expect(DocumentChecks.inspect({ ...parsed, now })).toEqual([
      { code: 'mrz_visual_mismatch', fields: ['documentNumber'] },
    ])
  })

  it('flags failed check digits', () => {
    const tampered = TD3.replace('L898902C36', 'L898902C46')
    const parsed = createDocumentParserRegistry().parse({ text: tampered })

    expect(DocumentChecks.inspect({ ...parsed, now })).toEqual([
      { code: 'mrz_check_digit', fields: ['documentNumber'] },
    ])
  })

  it('flags impossible dates', () => {
    const issues = DocumentChecks.inspect({
      fields: { dateOfBirth: '2027-01-01', issueDate: '2024-01-01', expiryDate: '2023-01-01' },
      now,
    }).map((issue) => issue.code)

    expect(issues).toEqual(['issue_after_expiry', 'birth_after_issue', 'birth_in_future'])
  })
})

describe('ageOn', () => {
  it('counts whole years, before and after the birthday', () => {
    expect(ageOn('2008-10-11', now)).toBe(18)
    expect(ageOn('2008-10-12', now)).toBe(17)
    expect(ageOn('not a date', now)).toBeNull()
  })
})
