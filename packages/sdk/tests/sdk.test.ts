import { describe, expect, it, vi } from 'vitest'
import { WebhookSigner } from '@arkyc/webhooks'
import { Arkyc, ArkycApiError } from '../src/index'

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
  })
})
