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

/** A fetch that answers `/claim` with a device token and every other path with `respond()`. */
function apiFetch(respond: () => Response, device = 'device_tok') {
  return vi.fn(async (url: string, _init?: RequestInit) =>
    url.endsWith('/claim')
      ? envelope({ token: device, expires_at: '2099-01-01T00:00:00Z' }, { status: 201 })
      : respond(),
  )
}

/** The fetch call for `path`, after the claim. */
function callTo(fetchMock: ReturnType<typeof apiFetch>, path: string) {
  return fetchMock.mock.calls.find(([url]) => url.endsWith(path))!
}

/** An in-memory stand-in for `localStorage`. */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))

  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

describe('ArkycClient', () => {
  it('requires a token', () => {
    expect(() => new ArkycClient({ token: '' })).toThrow(/token/)
  })

  it('claims a device token, sends it, and unwraps the envelope on getSession', async () => {
    const fetchMock = apiFetch(() => envelope({ id: 's1', status: 'started', expires_at: '2099-01-01' }))
    const client = new ArkycClient({
      token: 'ct_abc',
      baseUrl: 'https://api.test/v1/client/',
      fetch: fetchMock as never,
      storage: null,
    })

    const session = await client.getSession()

    expect(session).toEqual({ id: 's1', status: 'started', expires_at: '2099-01-01' })
    const [claimUrl, claimInit] = fetchMock.mock.calls[0]!
    expect(claimUrl).toBe('https://api.test/v1/client/claim')
    expect((claimInit as RequestInit).headers).toMatchObject({ 'X-Client-Token': 'ct_abc' })

    const [url, init] = fetchMock.mock.calls[1]!
    // `baseUrl` owns the prefix; the widget appends only the endpoint path.
    expect(url).toBe('https://api.test/v1/client/session')
    expect((init as RequestInit).method).toBe('GET')
    expect((init as RequestInit).headers).toMatchObject({ 'X-Client-Token': 'device_tok' })
  })

  it('defaults to the hosted Client API base when no baseUrl is given', async () => {
    const fetchMock = apiFetch(() => envelope({ id: 's1', status: 'started', expires_at: 'x' }))
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never, storage: null })

    await client.getSession()

    expect(fetchMock.mock.calls[0]![0]).toBe(`${DEFAULT_CLIENT_BASE_URL}/claim`)
    expect(fetchMock.mock.calls[1]![0]).toBe(`${DEFAULT_CLIENT_BASE_URL}/session`)
  })

  it('posts the document front as multipart form data with hints', async () => {
    const fetchMock = apiFetch(() => envelope({ id: 's1', status: 'document_submitted', expires_at: 'x' }))
    const client = new ArkycClient({
      token: 'ct',
      baseUrl: 'https://api.test/v1/client',
      fetch: fetchMock as never,
      storage: null,
    })

    await client.submitDocumentFront({
      image: new Blob(['x'], { type: 'image/jpeg' }),
      country: 'US',
      documentType: 'id_card',
      signals: { quality_score: 0.9, expired: false },
    })

    const [url, init] = callTo(fetchMock, '/document/front')
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
    const fetchMock = apiFetch(() => envelope({ id: 's1', status: 'processing', expires_at: 'x' }))
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never, storage: null })

    await client.complete({ signals: { face_similarity: 0.8 } })

    const [, init] = callTo(fetchMock, '/complete')
    expect((init as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ face_similarity: 0.8 })
  })

  it('throws a typed WidgetApiError on a non-2xx response', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      envelope(null, { ok: false, status: 401, message: 'Session expired' }),
    )
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never, storage: null })

    await expect(client.getSession()).rejects.toMatchObject({
      name: 'WidgetApiError',
      status: 401,
      message: 'Session expired',
    })
    await expect(client.getSession()).rejects.toBeInstanceOf(WidgetApiError)
  })

  it('claims once and reuses the device token, even for simultaneous calls', async () => {
    const fetchMock = apiFetch(() => envelope({ id: 's1', status: 'started', expires_at: 'x' }))
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never, storage: null })

    await Promise.all([client.getSession(), client.getSession()])
    await client.complete()

    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/claim'))).toHaveLength(1)
  })

  it('keeps the device token so a reload continues without claiming again', async () => {
    const storage = memoryStorage()
    const first = new ArkycClient({ token: 'ct', fetch: apiFetch(() => envelope({})) as never, storage })
    await first.getSession()

    const fetchMock = apiFetch(() => envelope({}))
    const reloaded = new ArkycClient({ token: 'ct', fetch: fetchMock as never, storage })
    await reloaded.getSession()

    expect(fetchMock.mock.calls.map(([url]) => url.split('/').pop())).toEqual(['session'])
    expect(fetchMock.mock.calls[0]![1]!.headers).toMatchObject({ 'X-Client-Token': 'device_tok' })
  })

  it('claims again once the stored device token has expired', async () => {
    const storage = memoryStorage({
      'arkyc:device:ct': JSON.stringify({ token: 'old', expires_at: '2000-01-01T00:00:00Z' }),
    })
    const fetchMock = apiFetch(() => envelope({}), 'fresh')
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never, storage })

    await expect(client.authToken()).resolves.toBe('fresh')
    expect(JSON.parse(storage.items.get('arkyc:device:ct')!).token).toBe('fresh')
  })

  it('reports a launch token that was already used', async () => {
    const fetchMock = vi.fn(async () =>
      envelope(null, { ok: false, status: 409, message: 'This verification link has already been used' }),
    )
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never, storage: null })

    await expect(client.getSession()).rejects.toMatchObject({
      status: 409,
      message: 'This verification link has already been used',
    })
  })

  it('mints a handoff token with the device token', async () => {
    const fetchMock = apiFetch(() => envelope({ token: 'handoff_tok', expires_at: '2099-01-01' }, { status: 201 }))
    const client = new ArkycClient({ token: 'ct', fetch: fetchMock as never, storage: null })

    await expect(client.createHandoffToken()).resolves.toBe('handoff_tok')

    const [url, init] = callTo(fetchMock, '/handoff')
    expect(url).toMatch(/\/handoff$/)
    expect((init as RequestInit).headers).toMatchObject({ 'X-Client-Token': 'device_tok' })
  })
})
