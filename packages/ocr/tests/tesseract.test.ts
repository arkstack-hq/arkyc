import { describe, expect, it } from 'vitest'
import { TesseractOcrDriver } from '../src'

// Canonical ICAO TD3 MRZ (valid check digits).
const TD3 = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'].join('\n')

describe('TesseractOcrDriver', () => {
  const dummy = new Uint8Array([1, 2, 3])

  it('recognizes text and extracts fields via the parser registry', async () => {
    const driver = new TesseractOcrDriver({
      recognize: async () => ({ text: TD3, confidence: 90 }),
    })
    const result = await driver.extract({ image: dummy, documentType: 'passport', country: 'GB' })
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

  it('returns empty fields when the engine yields no MRZ or other data', async () => {
    const driver = new TesseractOcrDriver({
      recognize: async () => ({ text: 'blurry unreadable text', confidence: 20 }),
    })
    const result = await driver.extract({ image: dummy })
    expect(result.fields).toEqual({})
  })

  it('reads the MRZ from the back of the card', async () => {
    const driver = new TesseractOcrDriver({
      // The back image (byte 2) carries the MRZ; the front (byte 1) does not.
      recognize: async (image) =>
        image[0] === 2 ? { text: TD3, confidence: 88 } : { text: 'SPECIMEN NAME', confidence: 60 },
    })
    const result = await driver.extract({
      image: new Uint8Array([1]),
      backImage: new Uint8Array([2]),
      documentType: 'id_card',
    })
    expect(result.fields.documentNumber).toBe('L898902C3')
    expect(result.fields.lastName).toBe('ERIKSSON')
  })

  it('skips the engine and returns empty for a 0-byte image', async () => {
    let called = false
    const driver = new TesseractOcrDriver({
      recognize: async () => {
        called = true
        return { text: TD3, confidence: 90 }
      },
    })
    const result = await driver.extract({ image: new Uint8Array() })
    expect(called).toBe(false)
    expect(result.fields).toEqual({})
    expect(result.confidence).toBe(0)
  })

  it('returns empty (does not throw) when the engine fails on a bad image', async () => {
    const driver = new TesseractOcrDriver({
      recognize: async () => {
        throw new Error('Image file cannot be read')
      },
    })
    const result = await driver.extract({ image: dummy })
    expect(result.fields).toEqual({})
    expect(result.confidence).toBe(0)
  })
})
