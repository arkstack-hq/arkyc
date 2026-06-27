import { ArkycClient, DEFAULT_CLIENT_BASE_URL, WidgetApiError } from '../src/client'
import { describe, expect, it, vi } from 'vitest'

function envelope(data: unknown, init: { ok?: boolean; status?: number; message?: string } = {}) {
  const status = init.status ?? 200
  return {
    ok: init.ok ?? true,
    status,
    text: async () => JSON.stringify({ status: 'success', message: init.message ?? 'OK', code: status, data }),
  } as Response
}

describe('ArkycClient', () => {
  it('requires a token', () => {
    expect(() => new ArkycClient({ token: '' })).toThrow(/token/)
  })

  it('sends the client token and unwraps the envelope on getSession', async () => {
    const fetchMock = vi.fn(async () => envelope({ id: 's1', status: 'started', expires_at: '2099-01-01' }))
    const client = new ArkycClient({
      token: 'ct_abc',
      baseUrl: 'https://api.test/v1/client/',
      fetch: fetchMock as never,
    })

    const session = await client.getSession()

    expect(session).toEqual({ id: 's1', status: 'started', expires_at: '2099-01-01' })
    const [url, init] = fetchMock.mock.calls[0]
    // `baseUrl` owns the prefix; the widget appends only the endpoint path.
    expect(url).toBe('https://api.test/v1/client/session')
    expect((init as RequestInit).method).toBe('GET')
    expect((init as RequestInit).headers).toMatchObject({ 'X-Client-Token': 'ct_abc' })
  })

  it('defaults to the hosted Client API base when no baseUrl is given', async () => {
    const fetchMock = vi.fn(async () => envelope({ id: 's1', status: 'started', expires_at: 'x' }))
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never })

    await client.getSession()

    expect(fetchMock.mock.calls[0][0]).toBe(`${DEFAULT_CLIENT_BASE_URL}/session`)
  })

  it('posts the document front as multipart form data with hints', async () => {
    const fetchMock = vi.fn(async () => envelope({ id: 's1', status: 'document_submitted', expires_at: 'x' }))
    const client = new ArkycClient({ token: 'ct', baseUrl: 'https://api.test/v1/client', fetch: fetchMock as never })

    await client.submitDocumentFront({
      image: new Blob(['x'], { type: 'image/jpeg' }),
      country: 'US',
      documentType: 'id_card',
      signals: { quality_score: 0.9, expired: false },
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/v1/client/document/front')
    const body = (init as RequestInit).body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('country')).toBe('US')
    expect(body.get('document_type')).toBe('id_card')
    expect(body.get('quality_score')).toBe('0.9')
    expect(body.get('expired')).toBe('false')
    expect(body.get('image')).toBeInstanceOf(Blob)
    // FormData drives the boundary header — we must not set Content-Type.
    expect((init as RequestInit).headers).not.toHaveProperty('Content-Type')
  })

  it('posts complete as JSON', async () => {
    const fetchMock = vi.fn(async () => envelope({ id: 's1', status: 'processing', expires_at: 'x' }))
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never })

    await client.complete({ signals: { face_similarity: 0.8 } })

    const [, init] = fetchMock.mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ face_similarity: 0.8 })
  })

  it('throws a typed WidgetApiError on a non-2xx response', async () => {
    const fetchMock = vi.fn(async () => envelope(null, { ok: false, status: 401, message: 'Session expired' }))
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never })

    await expect(client.getSession()).rejects.toMatchObject({
      name: 'WidgetApiError',
      status: 401,
      message: 'Session expired',
    })
    await expect(client.getSession()).rejects.toBeInstanceOf(WidgetApiError)
  })
})
