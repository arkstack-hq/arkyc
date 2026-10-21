import { describe, expect, it, vi } from 'vitest'
import { WebhookSigner } from '@arkyc/webhooks'
import { Arkyc, ArkycApiError, Webhooks } from '../src/index'

/** Build a fake fetch returning a JSON envelope with the given status. */
function fakeFetch(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch
}

const SESSION = {
  id: 'vs_1',
  project_id: 'proj_1',
  user_reference: 'user_9',
  status: 'pending',
  auto_decision: null,
  final_decision: null,
  decision_reason: null,
  risk_score: null,
  assigned_to: null,
  expires_at: '2026-01-01T00:15:00.000Z',
  completed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

describe('Arkyc server client', () => {
  it('creates a session and returns the client token', async () => {
    const fetchImpl = fakeFetch(201, { status: 'success', data: SESSION, client_token: 'ct_abc' })
    const arkyc = new Arkyc({
      secretKey: 'sk_test',
      baseUrl: 'https://api.test',
      fetch: fetchImpl,
    })

    const { session, clientToken } = await arkyc.sessions.create({ userReference: 'user_9' })

    expect(session.id).toBe('vs_1')
    expect(clientToken).toBe('ct_abc')
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://api.test/api/v1/sessions')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer sk_test' })
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      user_reference: 'user_9',
    })
  })

  it('retrieves and cancels a session', async () => {
    const arkyc = new Arkyc({
      secretKey: 'sk_test',
      baseUrl: 'https://api.test',
      fetch: fakeFetch(200, { status: 'success', data: SESSION }),
    })
    expect((await arkyc.sessions.retrieve('vs_1')).id).toBe('vs_1')

    const cancelled = new Arkyc({
      secretKey: 'sk_test',
      baseUrl: 'https://api.test',
      fetch: fakeFetch(200, { status: 'success', data: { ...SESSION, status: 'cancelled' } }),
    })
    expect((await cancelled.sessions.cancel('vs_1')).status).toBe('cancelled')
  })

  it('throws a typed ArkycApiError on a non-2xx response', async () => {
    const arkyc = new Arkyc({
      secretKey: 'sk_test',
      fetch: fakeFetch(404, { status: 'error', code: 404, message: 'Record not found' }),
    })

    await expect(arkyc.sessions.retrieve('missing')).rejects.toMatchObject({
      name: 'ArkycApiError',
      status: 404,
      message: 'Record not found',
    })
    await expect(arkyc.sessions.retrieve('missing')).rejects.toBeInstanceOf(ArkycApiError)
  })

  it('requires a secret key', () => {
    expect(() => new Arkyc({ secretKey: '' })).toThrow(/secretKey/)
  })

  it('verifies a webhook signature', () => {
    const arkyc = new Arkyc({ secretKey: 'sk_test' })
    const secret = 'whsec_x'
    const now = 1_700_000_000_000
    const ts = Math.floor(now / 1000)
    const body = JSON.stringify({ event: 'verification.approved' })
    const signature = WebhookSigner.sign(body, secret, ts)

    expect(arkyc.webhooks.verify({ payload: body, secret, signature, timestamp: ts, now })).toBe(true)
    expect(arkyc.webhooks.verify({ payload: '{}', secret, signature, timestamp: ts, now })).toBe(false)

    expect(arkyc.webhooks.constructEvent({ payload: body, secret, signature, timestamp: ts, now }).event).toBe(
      'verification.approved',
    )
    expect(() => arkyc.webhooks.constructEvent({ payload: '{}', secret, signature, timestamp: ts, now })).toThrow()
  })
})

const ENDPOINT = {
  id: 'we_1',
  project_id: 'proj_1',
  url: 'https://abc.ngrok-free.app/api/webhooks/kyc',
  events: ['verification.approved'],
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
}

/** The [url, init] of a fake fetch's nth call. */
const call = (fetchImpl: typeof fetch, n = 0) =>
  (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[n] as [string, RequestInit]

describe('webhook endpoints', () => {
  it('creates an endpoint and returns its one-time secret', async () => {
    const fetchImpl = fakeFetch(201, { status: 'success', data: ENDPOINT, secret: 'whsec_abc' })
    const arkyc = new Arkyc({ secretKey: 'sk_test', baseUrl: 'https://api.test', fetch: fetchImpl })

    const created = await arkyc.webhooks.endpoints.create({ url: ENDPOINT.url, events: ['verification.approved'] })

    expect(created).toEqual({ endpoint: ENDPOINT, secret: 'whsec_abc' })
    const [url, init] = call(fetchImpl)
    expect(url).toBe('https://api.test/api/v1/webhooks')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ url: ENDPOINT.url, events: ['verification.approved'] })
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk_test')
  })

  it('updates only the supplied fields', async () => {
    const fetchImpl = fakeFetch(200, { status: 'success', data: { ...ENDPOINT, url: 'https://new.example.com/hook' } })
    const arkyc = new Arkyc({ secretKey: 'sk_test', baseUrl: 'https://api.test', fetch: fetchImpl })

    const updated = await arkyc.webhooks.endpoints.update('we_1', { url: 'https://new.example.com/hook' })

    expect(updated.url).toBe('https://new.example.com/hook')
    const [url, init] = call(fetchImpl)
    expect(url).toBe('https://api.test/api/v1/webhooks/we_1')
    expect(init.method).toBe('PATCH')
    // Undefined fields are dropped by JSON, so the server leaves them unchanged.
    expect(JSON.parse(String(init.body))).toEqual({ url: 'https://new.example.com/hook' })
  })

  it('lists (with pagination) and retrieves endpoints', async () => {
    const listFetch = fakeFetch(200, { status: 'success', data: [ENDPOINT] })
    const list = new Arkyc({ secretKey: 'sk_test', baseUrl: 'https://api.test', fetch: listFetch })

    expect(await list.webhooks.endpoints.list()).toEqual([ENDPOINT])
    expect(call(listFetch)[0]).toBe('https://api.test/api/v1/webhooks')

    await list.webhooks.endpoints.list({ page: 2, perPage: 10 })
    expect(call(listFetch, 1)[0]).toBe('https://api.test/api/v1/webhooks?page=2&per_page=10')

    const showFetch = fakeFetch(200, { status: 'success', data: ENDPOINT })
    const show = new Arkyc({ secretKey: 'sk_test', baseUrl: 'https://api.test', fetch: showFetch })
    expect(await show.webhooks.endpoints.retrieve('we_1')).toEqual(ENDPOINT)
    expect(call(showFetch)[0]).toBe('https://api.test/api/v1/webhooks/we_1')
  })

  it('surfaces API errors as ArkycApiError', async () => {
    const arkyc = new Arkyc({
      secretKey: 'sk_test',
      fetch: fakeFetch(404, { status: 'error', code: 404, message: 'Record not found' }),
    })

    await expect(arkyc.webhooks.endpoints.retrieve('missing')).rejects.toBeInstanceOf(ArkycApiError)
  })

  it('refuses endpoint calls on a standalone verification-only Webhooks', async () => {
    await expect(new Webhooks().endpoints.list()).rejects.toThrow(/needs an Arkyc client/)
  })

  it('updates by signing secret, sending it in the body (not the url)', async () => {
    const fetchImpl = fakeFetch(200, {
      status: 'success',
      data: { ...ENDPOINT, url: 'https://tunnel.example.com/hook' },
    })
    const arkyc = new Arkyc({ secretKey: 'sk_test', baseUrl: 'https://api.test', fetch: fetchImpl })

    const updated = await arkyc.webhooks.endpoints.updateBySecret('whsec_abc', {
      url: 'https://tunnel.example.com/hook',
    })

    expect(updated.url).toBe('https://tunnel.example.com/hook')
    const [url, init] = call(fetchImpl)
    expect(url).toBe('https://api.test/api/v1/webhooks')
    expect(url).not.toContain('whsec_abc')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ secret: 'whsec_abc', url: 'https://tunnel.example.com/hook' })
  })
})
