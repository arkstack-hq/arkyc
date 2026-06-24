import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import request from 'parasito'
import { WebhookSigner } from '@arkyc/webhooks'
import { app } from '../src/core/bootstrap'
import { Organization } from '../src/app/models/Organization'
import { WebhookDelivery } from '../src/app/models/WebhookDelivery'

interface Captured {
  body: string
  signature: string
  timestamp: number
}

const fx = { token: '', organizationId: '', projectId: '', apiKeySecret: '' }
const received: Captured[] = []
let server: http.Server
let receiverUrl = ''

const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${fx.token}`)

const client = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/client/${path}`).set('X-Client-Token', token)

/** Open + complete a clean session; the sync queue runs ocr → biometric → webhook inline. */
async function completeSession(): Promise<string> {
  const open = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send({})
  const id = open.body.data.id
  const token = open.body.client_token
  await client('get', 'session', token)
  await client('post', 'document/front', token).send({})
  await client('post', 'liveness', token).send({})
  await client('post', 'complete', token).send({})

  return id
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => {
      received.push({
        body: Buffer.concat(chunks).toString('utf8'),
        signature: String(req.headers[WebhookSigner.SIGNATURE_HEADER.toLowerCase()] ?? ''),
        timestamp: Number(req.headers[WebhookSigner.TIMESTAMP_HEADER.toLowerCase()] ?? 0),
      })
      res.writeHead(200).end('ok')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  receiverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`

  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({
      firstname: 'Wh Owner',
      lastname: 'Test',
      email: `wh-${s}@test.dev`,
      password: 'secret123',
    })
  fx.token = reg.body.token

  const organization = await authed('post', '/organizations').send({ name: `Wh Co ${s}` })
  fx.organizationId = organization.body.data.id
  const project = await authed('post', `/organizations/${fx.organizationId}/projects`).send({
    name: 'Wh Prod',
  })
  fx.projectId = project.body.data.id
  const key = await authed('post', `/organizations/${fx.organizationId}/projects/${fx.projectId}/api-keys`).send({
    name: 'Wh key',
  })
  fx.apiKeySecret = key.body.secret
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

const webhooks = (suffix = '') => `/organizations/${fx.organizationId}/projects/${fx.projectId}/webhooks${suffix}`

describe('webhook endpoints', () => {
  it('returns the signing secret once on create, then hides it', async () => {
    const res = await authed('post', webhooks()).send({
      url: receiverUrl,
      events: ['verification.approved'],
    })
    expect(res.status).toBe(201)
    expect(res.body.secret).toMatch(/^whsec_/)
    expect(res.body.data.secret).toBeUndefined()
    expect(res.body.data.secret_hash).toBeUndefined()

    const list = await authed('get', webhooks())
    expect(list.body.data[0].secret_hash).toBeUndefined()
  })

  it('rejects an invalid event name', async () => {
    const res = await authed('post', webhooks()).send({
      url: receiverUrl,
      events: ['not.an.event'],
    })
    expect(res.status).toBe(422)
  })

  it('delivers a signed payload when a session completes', async () => {
    const create = await authed('post', webhooks()).send({
      url: receiverUrl,
      events: ['verification.approved', 'verification.completed'],
    })
    const secret = create.body.secret
    const before = received.length

    const sessionId = await completeSession()

    const delivered = received.slice(before)
    // Other endpoints may also deliver here; find the one signed for THIS secret.
    const hit = delivered.find(
      (d) =>
        JSON.parse(d.body).session_id === sessionId &&
        WebhookSigner.verify({
          payload: d.body,
          secret,
          signature: d.signature,
          timestamp: d.timestamp,
        }),
    )
    expect(hit).toBeTruthy()
    expect(JSON.parse(hit!.body).event).toBe('verification.approved')

    const endpointId = create.body.data.id
    const deliveries = await WebhookDelivery.where({ webhookEndpointId: endpointId }).get()
    expect(Array.from(deliveries).some((d) => d.status === 'delivered')).toBe(true)
  })

  it('records a failed delivery when the endpoint is unreachable', async () => {
    const create = await authed('post', webhooks()).send({
      url: 'http://127.0.0.1:1/down',
      events: ['verification.approved'],
    })
    const endpointId = create.body.data.id

    await completeSession()

    const deliveries = Array.from(await WebhookDelivery.where({ webhookEndpointId: endpointId }).get())
    expect(deliveries.length).toBeGreaterThan(0)
    expect(deliveries.every((d) => d.status === 'failed')).toBe(true)
    expect(deliveries[0].attempts).toBeGreaterThanOrEqual(1)
  })
})
