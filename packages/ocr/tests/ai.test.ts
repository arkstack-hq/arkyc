import { describe, expect, it } from 'vitest'
import { AnthropicOcrDriver, OcrDriverFactory, scoreConfidence } from '../src/index'
import type { AiVisionExtract } from '../src/index'

const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

const fullFields = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  dateOfBirth: '1990-01-01',
  documentNumber: 'X1234567',
  expiryDate: '2035-01-01',
  nationality: 'GBR',
}

describe('ai ocr driver', () => {
  it('requires an api key (or an injected vision call)', () => {
    expect(() => OcrDriverFactory.create({ driver: 'ai' })).toThrow(/apiKey/)
    expect(() => new AnthropicOcrDriver({ extract: async () => ({ fields: {} }) })).not.toThrow()
  })

  it('maps the vision response and derives confidence from valid fields', async () => {
    const extract: AiVisionExtract = async () => ({ fields: fullFields, legibility: 1 })
    const driver = new AnthropicOcrDriver({ extract })

    const result = await driver.extract({ image })
    expect(result.fields.fullName).toBeUndefined()
    expect(result.fields.firstName).toBe('Ada')
    expect(result.fields.nationality).toBe('GBR')
    // Every field present + valid + crisp legibility → top confidence.
    expect(result.confidence).toBeCloseTo(1, 5)
    expect((result.raw as { provider: string }).provider).toBe('ai')
  })

  it('passes both sides of the document to the vision call', async () => {
    let count = 0
    const extract: AiVisionExtract = async (_req, images) => {
      count = images.length
      return { fields: fullFields }
    }
    await new AnthropicOcrDriver({ extract }).extract({ image, backImage: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) })
    expect(count).toBe(2)
  })

  it('trims blank fields out of the result', async () => {
    const extract: AiVisionExtract = async () => ({ fields: { firstName: '  Grace  ', lastName: '' } })
    const result = await new AnthropicOcrDriver({ extract }).extract({ image })
    expect(result.fields.firstName).toBe('Grace')
    expect(result.fields.lastName).toBeUndefined()
  })
})

describe('scoreConfidence', () => {
  it('rises with completeness and structural validity', () => {
    expect(scoreConfidence({})).toBe(0)
    expect(scoreConfidence(fullFields)).toBeCloseTo(1, 5)
    // fullName satisfies the name check when first/last are absent.
    expect(scoreConfidence({ fullName: 'Ada Lovelace' })).toBeCloseTo(0.28, 5)
  })

  it('rejects malformed dates', () => {
    const good = scoreConfidence({ dateOfBirth: '1990-01-01' })
    const bad = scoreConfidence({ dateOfBirth: '01/01/1990' })
    expect(good).toBeGreaterThan(bad)
    expect(bad).toBe(0)
  })

  it('lets poor legibility soft-penalise a complete read by at most 15%', () => {
    expect(scoreConfidence(fullFields, 0)).toBeCloseTo(0.85, 5)
    expect(scoreConfidence(fullFields, 1)).toBeCloseTo(1, 5)
  })

  it('needs a document number of at least four characters', () => {
    expect(scoreConfidence({ documentNumber: 'AB' })).toBe(0)
    expect(scoreConfidence({ documentNumber: 'X1234567' })).toBeCloseTo(0.22, 5)
  })
})
