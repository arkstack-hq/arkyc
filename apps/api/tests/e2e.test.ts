import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import request from 'parasito'
import { Arkyc } from '@arkyc/sdk'
import type { WebhookEvent } from '@arkyc/types'
import { WebhookSigner } from '@arkyc/webhooks'
import { app } from '../src/core/bootstrap'
import { Organization } from '../src/app/models/Organization'

/**
 * The happy path across every surface: an integrator creates a session with the
 * SDK, the user verifies through the Client API, the decision lands in review, a
 * reviewer approves it, the signed webhook arrives, and the SDK reads the outcome.
 */

type Delivery = { body: string; signature: string; timestamp: number }

const fx = { token: '', organizationId: '', projectId: '', apiKeySecret: '', webhookSecret: '' }
const deliveries: Delivery[] = []
let api: http.Server
let receiver: http.Server
let apiUrl = ''
let receiverUrl = ''

const dashboard = (path: string) =>
  request(app).post(`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${fx.token}`)

const clientApi = (path: string, token: string) =>
  request(app).post(`/api/v1/client/${path}`).set('X-Client-Token', token)

const listen = async (server: http.Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const close = (server?: http.Server) =>
  new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))

beforeAll(async () => {
  await app.startup(undefined, true)
  api = http.createServer(app.getAppInstance() as never)
  apiUrl = await listen(api)

  receiver = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => {
      deliveries.push({
        body: Buffer.concat(chunks).toString('utf8'),
        signature: String(req.headers[WebhookSigner.SIGNATURE_HEADER.toLowerCase()] ?? ''),
        timestamp: Number(req.headers[WebhookSigner.TIMESTAMP_HEADER.toLowerCase()] ?? 0),
      })
      res.writeHead(200).end('ok')
    })
  })
  receiverUrl = `${await listen(receiver)}/hook`

  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'E2E Owner', lastname: 'Test', email: `e2e-${s}@test.dev`, password: 'secret123' })
  fx.token = reg.body.token

  fx.organizationId = (await dashboard('/organizations').send({ name: `E2E Co ${s}` })).body.data.id
  fx.projectId = (await dashboard(`/organizations/${fx.organizationId}/projects`).send({ name: 'E2E' })).body.data.id

  const project = `/organizations/${fx.organizationId}/projects/${fx.projectId}`
  fx.apiKeySecret = (await dashboard(`${project}/api-keys`).send({ name: 'E2E key' })).body.secret
  fx.webhookSecret = (
    await dashboard(`${project}/webhooks`).send({
      url: receiverUrl,
      events: ['verification.requires_review', 'verification.approved'],
    })
  ).body.secret
})

afterAll(async () => {
  await close(api)
  await close(receiver)
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('verification happy path', () => {
  it('runs from SDK session creation to a reviewed, webhooked, SDK-visible approval', async () => {
    const arkyc = new Arkyc({ secretKey: fx.apiKeySecret, baseUrl: apiUrl })

    // 1. The integrator creates a session over HTTP with the SDK.
    const created = await arkyc.sessions.create({ userReference: 'e2e-user' })
    expect(created.session.status).toBe('pending')
    expect(created.clientToken).toEqual(expect.any(String))

    // 2. The widget claims its device token and verifies (low document quality → review).
    const claim = await request(app).post('/api/v1/client/claim').set('X-Client-Token', created.clientToken).send({})
    expect(claim.status).toBe(201)
    const device = claim.body.data.token

    expect((await request(app).get('/api/v1/client/session').set('X-Client-Token', device)).status).toBe(201)
    expect((await clientApi('document/front', device).send({ quality_score: 0.4 })).status).toBe(201)
    expect((await clientApi('liveness', device).send({})).status).toBe(201)
    // Completion is accepted and decided asynchronously (inline under the sync queue in tests).
    expect((await clientApi('complete', device).send({})).status).toBe(202)

    // 3. The automated decision sends it to manual review.
    const pending = await arkyc.sessions.retrieve(created.session.id)
    expect(pending.status).toBe('requires_review')

    // 4. A reviewer approves it from the dashboard.
    const approved = await dashboard(`/organizations/${fx.organizationId}/sessions/${created.session.id}/approve`).send(
      {
        reason: 'Looks good',
      },
    )
    expect(approved.status).toBe(200)

    // 5. Signed webhooks reached the integrator, in order.
    const events = deliveries.map((delivery) => JSON.parse(delivery.body) as WebhookEvent)
    expect(events.map((event) => event.event)).toEqual(['verification.requires_review', 'verification.approved'])
    expect(events.every((event) => event.session_id === created.session.id)).toBe(true)
    for (const delivery of deliveries) {
      expect(
        arkyc.webhooks.verify({
          payload: delivery.body,
          secret: fx.webhookSecret,
          signature: delivery.signature,
          timestamp: delivery.timestamp,
        }),
      ).toBe(true)
    }

    // 6. The SDK sees the final decision.
    const final = await arkyc.sessions.retrieve(created.session.id)
    expect(final.status).toBe('approved')
    expect(final.final_decision).toBe('approved')
  })
})
