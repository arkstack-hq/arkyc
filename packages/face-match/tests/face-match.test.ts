import { describe, expect, it } from 'vitest'
import { MockFaceMatchDriver, FaceMatchDriverFactory } from '../src/index'

const request = { documentPortrait: new Uint8Array([1]), selfie: new Uint8Array([2]) }

describe('face-match', () => {
  it('mock driver passes by default', async () => {
    const driver = FaceMatchDriverFactory.create({ driver: 'mock' })
    const result = await driver.compare(request)
    expect(result.passed).toBe(true)
    expect(result.similarityScore).toBeGreaterThan(0.5)
  })

  it('hints steer the similarity and verdict', async () => {
    const result = await new MockFaceMatchDriver().compare({
      ...request,
      hints: { similarityScore: 0.1, passed: false },
    })
    expect(result.passed).toBe(false)
    expect(result.similarityScore).toBe(0.1)
  })

  it('requires an endpoint for the external driver', () => {
    expect(() => FaceMatchDriverFactory.create({ driver: 'external' })).toThrow(/endpoint/)
  })
})
