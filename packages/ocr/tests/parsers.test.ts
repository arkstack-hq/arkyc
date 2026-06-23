import { describe, expect, it } from 'vitest'
import { createDocumentParserRegistry, mrzParser } from '../src'
import type { DocumentParser } from '../src'

// Canonical ICAO 9303 TD3 example (valid check digits).
const TD3 = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'].join('\n')

describe('mrzParser (TD3)', () => {
  it('extracts identity fields from a passport MRZ', () => {
    const out = mrzParser().parse({ text: TD3 })
    expect(out).not.toBeNull()
    expect(out!.fields).toMatchObject({
      lastName: 'ERIKSSON',
      firstName: 'ANNA',
      fullName: 'ANNA MARIA ERIKSSON',
      documentNumber: 'L898902C3',
      nationality: 'UTO',
      dateOfBirth: '1974-08-12',
      expiryDate: '2012-04-15',
    })
  })

  it('reports full confidence when all check digits validate', () => {
    expect(mrzParser().parse({ text: TD3 })!.confidence).toBe(1)
  })

  it('returns null when there is no MRZ', () => {
    expect(mrzParser().parse({ text: 'just some plain text\nno machine readable zone' })).toBeNull()
  })
})

describe('DocumentParserRegistry', () => {
  const usLicense: DocumentParser = {
    name: 'us-dl',
    countries: ['US', 'USA'],
    documentTypes: ['drivers_license'],
    parse: () => ({ fields: { firstName: 'Pat', lastName: 'Doe' }, confidence: 0.8 }),
  }

  it('falls back to MRZ when no parser matches the selection', () => {
    const registry = createDocumentParserRegistry().register(usLicense)
    const out = registry.parse({ text: TD3, country: 'GB', documentType: 'passport' })
    expect(out.fields.documentNumber).toBe('L898902C3')
    expect((out.raw as { fallback?: boolean }).fallback).toBe(true)
  })

  it('uses a country+type specific parser when it matches the user input', () => {
    const registry = createDocumentParserRegistry().register(usLicense)
    const out = registry.parse({ text: 'whatever', country: 'US', documentType: 'drivers_license' })
    expect(out.fields).toMatchObject({ firstName: 'Pat', lastName: 'Doe' })
    expect((out.raw as { parser?: string }).parser).toBe('us-dl')
  })

  it('orders candidates most-specific first', () => {
    const anyType: DocumentParser = { name: 'any', parse: () => null }
    const typeOnly: DocumentParser = { name: 'type', documentTypes: ['passport'], parse: () => null }
    const registry = createDocumentParserRegistry().register(anyType).register(typeOnly).register(usLicense)
    const names = registry.candidates('US', 'drivers_license').map((p) => p.name)
    // us-dl (country+type) before any (unscoped); type-only excluded (passport).
    expect(names[0]).toBe('us-dl')
    expect(names).toContain('any')
    expect(names).not.toContain('type')
  })

  it('does not match a country-scoped parser when no country is provided', () => {
    const registry = createDocumentParserRegistry().register(usLicense)
    expect(registry.candidates(null, 'drivers_license')).toHaveLength(0)
  })

  it('returns empty fields (confidence 0) when nothing can parse', () => {
    const registry = createDocumentParserRegistry()
    const out = registry.parse({ text: 'no mrz here' })
    expect(out.fields).toEqual({})
    expect(out.confidence).toBe(0)
  })
})
