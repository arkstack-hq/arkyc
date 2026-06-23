import { describe, expect, it } from 'vitest'
import { TesseractOcrDriver } from '../src'

// Canonical ICAO TD3 MRZ (valid check digits).
const TD3 = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'].join('\n')

describe('TesseractOcrDriver', () => {
  it('recognizes text and extracts fields via the parser registry', async () => {
    const driver = new TesseractOcrDriver({
      recognize: async () => ({ text: TD3, confidence: 90 }),
    })
    const result = await driver.extract({ image: new Uint8Array(), documentType: 'passport', country: 'GB' })
    expect(result.fields).toMatchObject({
      lastName: 'ERIKSSON',
      documentNumber: 'L898902C3',
      dateOfBirth: '1974-08-12',
      expiryDate: '2012-04-15',
    })
    // Engine 0.9 blended with parser 1.0 → 0.95.
    expect(result.confidence).toBeCloseTo(0.95, 2)
    expect((result.raw as { engine?: string }).engine).toBe('tesseract')
  })

  it('returns empty fields when the engine yields no MRZ', async () => {
    const driver = new TesseractOcrDriver({
      recognize: async () => ({ text: 'blurry unreadable text', confidence: 20 }),
    })
    const result = await driver.extract({ image: new Uint8Array() })
    expect(result.fields).toEqual({})
  })
})
