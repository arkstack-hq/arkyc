import { describe, expect, it } from 'vitest'
import { TesseractOcrDriver, buildSharpPreprocessor } from '../src'

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
    // A check-digit-verified MRZ (parser 1.0) is parser-dominant: engine 0.9 only
    // lifts it slightly → 1.0*0.9 + 0.9*0.1 = 0.99.
    expect(result.confidence).toBeCloseTo(0.99, 2)
    expect((result.raw as { engine?: string }).engine).toBe('tesseract')
    expect((result.raw as { stage?: string }).stage).toBe('mrz')
  })

  it('keeps a check-digit-verified MRZ high even when the engine is unsure', async () => {
    // OCR-B reads make Tesseract pessimistic; a verified MRZ must not be dragged down.
    const driver = new TesseractOcrDriver({
      recognize: async () => ({ text: TD3, confidence: 35 }),
    })
    const result = await driver.extract({ image: dummy, documentType: 'passport' })
    // Parser 1.0 dominates: 1.0*0.9 + 0.35*0.1 = 0.935.
    expect(result.confidence).toBeGreaterThan(0.9)
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

  it('preprocesses each side before recognition', async () => {
    const seen: Uint8Array[] = []
    const driver = new TesseractOcrDriver({
      // Tag the bytes so we can assert the recognizer saw the preprocessed image.
      preprocess: async (image) => new Uint8Array([...image, 99]),
      recognize: async (image) => {
        seen.push(image)
        return { text: TD3, confidence: 90 }
      },
    })
    await driver.extract({ image: new Uint8Array([1]), backImage: new Uint8Array([2]) })
    expect(seen).toEqual([new Uint8Array([1, 99]), new Uint8Array([2, 99])])
  })

  it('skips preprocessing when disabled', async () => {
    let seen: Uint8Array | null = null
    const driver = new TesseractOcrDriver({
      preprocess: false,
      recognize: async (image) => {
        seen = image
        return { text: TD3, confidence: 90 }
      },
    })
    await driver.extract({ image: new Uint8Array([7]) })
    expect(seen).toEqual(new Uint8Array([7]))
  })
})

describe('buildSharpPreprocessor', () => {
  // A fake `sharp` instance recording the pipeline calls; toBuffer yields a marker.
  function fakeSharp(width: number, calls: string[]) {
    const instance = {
      metadata: async () => ({ width }),
      grayscale: () => (calls.push('grayscale'), instance),
      normalise: () => (calls.push('normalise'), instance),
      median: (n: number) => (calls.push(`median:${n}`), instance),
      sharpen: () => (calls.push('sharpen'), instance),
      resize: (o: { width: number }) => (calls.push(`resize:${o.width}`), instance),
      png: () => (calls.push('png'), instance),
      toBuffer: async () => Buffer.from([42]),
    }
    return instance
  }

  it('runs the grayscale/normalise/sharpen pipeline and upscales small images', async () => {
    const calls: string[] = []
    const pre = buildSharpPreprocessor(() => fakeSharp(800, calls) as never, { minWidth: 1600 })
    const out = await pre(new Uint8Array([1, 2, 3]))
    expect(out).toEqual(new Uint8Array([42]))
    expect(calls).toContain('grayscale')
    expect(calls).toContain('normalise')
    expect(calls).toContain('resize:1600')
  })

  it('does not upscale images already at least minWidth', async () => {
    const calls: string[] = []
    const pre = buildSharpPreprocessor(() => fakeSharp(2000, calls) as never, { minWidth: 1600 })
    await pre(new Uint8Array([1]))
    expect(calls.some((c) => c.startsWith('resize'))).toBe(false)
  })

  it('falls back to the original bytes when sharp throws', async () => {
    const pre = buildSharpPreprocessor(() => {
      throw new Error('unsupported image format')
    })
    const input = new Uint8Array([1, 2, 3])
    expect(await pre(input)).toBe(input)
  })
})
