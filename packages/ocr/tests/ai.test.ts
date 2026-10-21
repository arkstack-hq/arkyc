import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OcrAuthenticity } from '@arkyc/types'
import { AnthropicOcrDriver, OcrDriverFactory, applyAuthenticity, scoreConfidence } from '../src/index'
import type { AiVisionExtract } from '../src/index'

const genuine: OcrAuthenticity = {
  genuine: true,
  confidence: 1,
  screenReplay: false,
  photocopy: false,
  digitalTampering: false,
  physicalTampering: false,
  observations: [],
}

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

  it('surfaces a genuine authenticity read without touching confidence', async () => {
    const extract: AiVisionExtract = async () => ({ fields: fullFields, legibility: 1, authenticity: genuine })
    const result = await new AnthropicOcrDriver({ extract }).extract({ image })
    expect(result.authenticity?.genuine).toBe(true)
    expect(result.confidence).toBeCloseTo(1, 5)
    expect((result.raw as { authenticity: OcrAuthenticity }).authenticity.genuine).toBe(true)
  })

  it('caps confidence into the review band when authenticity is flagged', async () => {
    const flagged: OcrAuthenticity = {
      ...genuine,
      genuine: false,
      confidence: 0.15,
      screenReplay: true,
      observations: ['visible moiré pattern'],
    }
    const extract: AiVisionExtract = async () => ({ fields: fullFields, legibility: 1, authenticity: flagged })
    const result = await new AnthropicOcrDriver({ extract }).extract({ image })
    // A clean field read (≈1) is pulled down so the session routes to review.
    expect(result.confidence).toBeLessThanOrEqual(0.5)
    expect(result.authenticity?.screenReplay).toBe(true)
  })
})

describe('ai ocr driver — http retry/timeout', () => {
  afterEach(() => vi.unstubAllGlobals())

  const toolResponse = (input: Record<string, unknown> = fullFields) =>
    new Response(
      JSON.stringify({
        content: [{ type: 'tool_use', name: 'read_document', input }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )

  it('retries an overloaded (529) response, honouring retry-after', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('overloaded', { status: 529, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(toolResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await new AnthropicOcrDriver({ apiKey: 'k' }).extract({ image })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.fields.firstName).toBe('Ada')
    // Each attempt carries an abort signal (the per-request timeout).
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })

  it('maps the model authenticity flags off the tool response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      toolResponse({
        ...fullFields,
        digitalTampering: true,
        authenticityConfidence: 0.1,
        authenticityObservations: ['date font does not match', '   ', 42],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await new AnthropicOcrDriver({ apiKey: 'k' }).extract({ image })
    expect(result.authenticity?.genuine).toBe(false)
    expect(result.authenticity?.digitalTampering).toBe(true)
    expect(result.authenticity?.observations).toEqual(['date font does not match'])
    expect(result.confidence).toBeLessThanOrEqual(0.5)
  })

  it('omits authenticity entirely when the model reports nothing about it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(toolResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await new AnthropicOcrDriver({ apiKey: 'k' }).extract({ image })
    expect(result.authenticity).toBeUndefined()
    expect(result.confidence).toBeCloseTo(1, 5)
  })

  it('gives up after the retry budget and surfaces the error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(new AnthropicOcrDriver({ apiKey: 'k', maxRetries: 1 }).extract({ image })).rejects.toThrow(/429/)
    expect(fetchMock).toHaveBeenCalledTimes(2) // initial + 1 retry
  })
})

describe('ai ocr driver — workers ai backend', () => {
  afterEach(() => vi.unstubAllGlobals())

  const chatResponse = (message: Record<string, unknown>) =>
    new Response(JSON.stringify({ choices: [{ message }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  it('requires an account id', () => {
    expect(() => OcrDriverFactory.create({ driver: 'ai', aiProvider: 'workers-ai', apiKey: 'k' })).toThrow(/accountId/)
  })

  it('calls the account chat-completions endpoint with the default gemma model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse({
        tool_calls: [{ function: { name: 'read_document', arguments: JSON.stringify(fullFields) } }],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const driver = OcrDriverFactory.create({ driver: 'ai', aiProvider: 'workers-ai', apiKey: 'cf', accountId: 'acc' })
    const result = await driver.extract({ image })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/ai/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer cf')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('@cf/google/gemma-4-26b-a4b-it')
    expect(body.messages[1].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/)
    expect(result.fields.firstName).toBe('Ada')
    expect(result.raw).toMatchObject({ backend: 'workers-ai', model: '@cf/google/gemma-4-26b-a4b-it' })
  })

  it('requires every identity field, and treats an empty answer as unread', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatResponse({
        tool_calls: [
          {
            function: {
              name: 'read_document',
              arguments: JSON.stringify({ ...fullFields, lastName: '', documentNumber: '', fullName: '' }),
            },
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const driver = new AnthropicOcrDriver({ provider: 'workers-ai', apiKey: 'cf', accountId: 'acc', model: '@cf/x' })
    const result = await driver.extract({ image })

    // A model can't answer with the authenticity read alone (both Gemma and
    // Llama 4 Scout did): the schema makes it return each identity field.
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.tools[0].function.parameters.required).toEqual(
      expect.arrayContaining(['lastName', 'firstName', 'dateOfBirth', 'documentNumber']),
    )
    expect(body.messages[0].content).toMatch(/main task is to read the identity fields/)
    expect(result.fields.firstName).toBe('Ada')
    expect(result.fields.lastName).toBeUndefined()
    expect(result.fields.documentNumber).toBeUndefined()
  })

  it('accepts object tool arguments and falls back to JSON in the message text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        chatResponse({ tool_calls: [{ function: { name: 'read_document', arguments: fullFields } }] }),
      )
      .mockResolvedValueOnce(chatResponse({ content: '```json\n' + JSON.stringify(fullFields) + '\n```' }))
      .mockResolvedValueOnce(chatResponse({ content: 'I cannot read this.' }))
    vi.stubGlobal('fetch', fetchMock)

    const driver = new AnthropicOcrDriver({ provider: 'workers-ai', apiKey: 'cf', accountId: 'acc', model: '@cf/x' })
    expect((await driver.extract({ image })).fields.documentNumber).toBe('X1234567')
    expect((await driver.extract({ image })).fields.lastName).toBe('Lovelace')
    await expect(driver.extract({ image })).rejects.toThrow(/no structured fields/)
  })
  it('maps common field aliases (NIN slip style) and keeps the model output', async () => {
    const nin = {
      surname: 'OKAFOR',
      first_name: 'CHIDI',
      nin: 12345678901,
      dob: '1990-05-17',
      documentType: 'id_card',
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          chatResponse({ tool_calls: [{ function: { name: 'read_document', arguments: JSON.stringify(nin) } }] }),
        ),
    )

    const driver = new AnthropicOcrDriver({ provider: 'workers-ai', apiKey: 'cf', accountId: 'acc', model: '@cf/x' })
    const result = await driver.extract({ image })

    expect(result.fields).toMatchObject({
      lastName: 'OKAFOR',
      firstName: 'CHIDI',
      documentNumber: '12345678901',
      dateOfBirth: '1990-05-17',
    })
    // What the model actually returned is kept for debugging.
    expect((result.raw as { modelOutput: unknown }).modelOutput).toEqual(nin)
  })

  it('reads fields nested under a `fields` object', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        chatResponse({
          tool_calls: [
            {
              function: {
                name: 'read_document',
                arguments: JSON.stringify({ fields: { lastName: 'Lovelace', documentNumber: 'X1' } }),
              },
            },
          ],
        }),
      ),
    )

    const driver = new AnthropicOcrDriver({ provider: 'workers-ai', apiKey: 'cf', accountId: 'acc', model: '@cf/x' })
    expect((await driver.extract({ image })).fields).toMatchObject({ lastName: 'Lovelace', documentNumber: 'X1' })
  })

  it('honours a configured timeout and retry count from the factory config', async () => {
    // A model that never answers: each attempt hangs until its timeout aborts it.
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted due to timeout')))
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const driver = OcrDriverFactory.create({
      driver: 'ai',
      aiProvider: 'workers-ai',
      apiKey: 'cf',
      accountId: 'acc',
      timeoutMs: 20,
      maxRetries: 1,
    })
    const startedAt = Date.now()

    await expect(driver.extract({ image })).rejects.toThrow(/timeout/)
    expect(fetchMock).toHaveBeenCalledTimes(2) // first attempt + 1 retry
    expect(Date.now() - startedAt).toBeLessThan(5_000)
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

describe('applyAuthenticity', () => {
  it('leaves the score untouched when genuine or unassessed', () => {
    expect(applyAuthenticity(1, undefined)).toBe(1)
    expect(applyAuthenticity(0.9, genuine)).toBe(0.9)
  })

  it('caps a flagged document at the suspect ceiling and the model confidence', () => {
    const flagged = { ...genuine, genuine: false, confidence: 0.15, photocopy: true }
    expect(applyAuthenticity(1, flagged)).toBeCloseTo(0.15, 5)
    // Even an over-confident model can't push a flagged doc above the 0.5 ceiling.
    expect(applyAuthenticity(1, { ...flagged, confidence: 0.95 })).toBeCloseTo(0.5, 5)
  })

  it('never raises a low field score', () => {
    expect(applyAuthenticity(0.3, { ...genuine, genuine: false, confidence: 0.95, photocopy: true })).toBeCloseTo(
      0.3,
      5,
    )
  })
})
