import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OcrResultData } from '@arkyc/types'

// The fallback driver every test falls back to (OCR_FALLBACK_DRIVER).
const fallback = {
  name: 'tesseract',
  extract: vi.fn(
    async (): Promise<OcrResultData> => ({
      fields: { lastName: 'OKAFOR', documentNumber: '12345678901' },
      confidence: 0.7,
      raw: { provider: 'tesseract' },
    }),
  ),
}

vi.mock('@app/services/providers', async (original) => ({
  ...(await original<typeof import('../src/app/services/providers')>()),
  fallbackOcrDriver: fallback,
}))

// Boot the app with one request: that installs the `config` global the job's
// queue field reads.
const { app } = await import('../src/core/bootstrap')

await (await import('parasito')).default(app).get('/api/health')
const { OcrJob } = await import('../src/app/jobs/OcrJob')

type Extract = (
  primary: { name: string; extract: (request: unknown) => Promise<OcrResultData> },
  request: unknown,
  sessionId: string,
) => Promise<OcrResultData>

const extract = (primary: Parameters<Extract>[0]) =>
  (new OcrJob('session-1') as unknown as { extract: Extract }).extract(
    primary,
    { image: new Uint8Array() },
    'session-1',
  )

const authenticity = { genuine: true, photocopy: false, screenReplay: false, confidence: 1 } as never

describe('OcrJob primary → fallback OCR', () => {
  afterEach(() => {
    fallback.extract.mockClear()
    vi.restoreAllMocks()
  })

  it('keeps the primary result when it read a name, the number and the birth date', async () => {
    const primary = {
      name: 'ai',
      extract: vi.fn(async () => ({
        fields: { fullName: 'Ada Lovelace', documentNumber: 'A1234567', dateOfBirth: '1815-12-10' },
        confidence: 0.9,
        raw: { provider: 'ai' },
      })),
    }

    const result = await extract(primary as never)

    expect(result.fields.fullName).toBe('Ada Lovelace')
    expect(fallback.extract).not.toHaveBeenCalled()
  })

  it('fills only the fields the primary missed from the fallback', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const primary = {
      name: 'ai',
      extract: vi.fn(async () => ({
        fields: { dateOfBirth: '1988-03-03', lastName: 'EZE' },
        confidence: 0.8,
        authenticity,
        raw: { provider: 'ai' },
      })),
    }

    const result = await extract(primary as never)

    // The primary's own reads win; the fallback only adds what was missing.
    expect(result.fields).toEqual({ dateOfBirth: '1988-03-03', lastName: 'EZE', documentNumber: '12345678901' })
    expect(result.confidence).toBe(0.8)
    expect(result.authenticity).toBe(authenticity)
    expect(result.raw).toMatchObject({ toppedUpFrom: 'tesseract', added: ['documentNumber'] })
  })

  it('keeps a partial primary read when the top-up fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fallback.extract.mockRejectedValueOnce(new Error('tesseract failed'))
    const primary = {
      name: 'ai',
      extract: vi.fn(async () => ({ fields: { dateOfBirth: '1988-03-03' }, confidence: 0.8, raw: { provider: 'ai' } })),
    }

    const result = await extract(primary as never)

    expect(result.fields).toEqual({ dateOfBirth: '1988-03-03' })
  })

  it('falls back when the primary throws (e.g. a misconfigured AI provider)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const primary = {
      name: 'ai',
      extract: vi.fn(async () => {
        throw new Error('AnthropicOcrDriver (workers-ai) request failed with status 404')
      }),
    }

    const result = await extract(primary as never)

    expect(result.fields).toMatchObject({ lastName: 'OKAFOR', documentNumber: '12345678901' })
    expect(result.raw).toMatchObject({ fallbackFrom: 'ai', reason: expect.stringContaining('404'), primary: null })
  })

  it('falls back when the primary reads no identity field, keeping its authenticity read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const primary = {
      name: 'ai',
      extract: vi.fn(async () => ({ fields: {}, confidence: 0, authenticity, raw: { provider: 'ai' } })),
    }

    const result = await extract(primary)

    expect(result.fields.lastName).toBe('OKAFOR')
    expect(result.authenticity).toBe(authenticity)
    expect(result.raw).toMatchObject({
      fallbackFrom: 'ai',
      reason: 'read no identity fields',
      primary: { provider: 'ai' },
      fallback: { provider: 'tesseract' },
    })
  })

  it('does not retry the same driver when the primary already is the fallback', async () => {
    fallback.extract.mockRejectedValueOnce(new Error('tesseract failed'))

    await expect(extract(fallback)).rejects.toThrow('tesseract failed')
    expect(fallback.extract).toHaveBeenCalledTimes(1)
  })
})
