import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { MemoryRealtimeDriver } from '@arkyc/realtime'
import { realtimeChannels, REALTIME_EVENT } from '@arkyc/types'
import { app } from '../src/core/bootstrap'
import { Organization } from '../src/app/models/Organization'

/** Phase 16 — realtime broadcasts from the transition + review choke points. */
const fx = { token: '', outsiderToken: '', ownerId: '', organizationId: '', projectId: '', apiKeySecret: '' }

const authed = (method: 'get' | 'post', path: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${fx.token}`)

const client = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/client/${path}`).set('X-Client-Token', token)

/** Open a session and walk it to `requires_review` (low document quality). */
async function reviewableSession(): Promise<string> {
  const open = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send({})
  const { id } = open.body.data
  const token = open.body.client_token

  await client('get', 'session', token)
  await client('post', 'document/front', token).send({ quality_score: 0.4 })
  await client('post', 'liveness', token).send({})
  await client('post', 'complete', token).send({})

  return id
}

beforeAll(async () => {
  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'RT Owner', lastname: 'Test', email: `rt-${s}@test.dev`, password: 'secret123' })
  fx.token = reg.body.token
  fx.ownerId = reg.body.data.id

  const outsider = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'RT Outsider', lastname: 'Test', email: `rt-out-${s}@test.dev`, password: 'secret123' })
  fx.outsiderToken = outsider.body.token

  const organization = await authed('post', '/organizations').send({ name: `RT Co ${s}` })
  fx.organizationId = organization.body.data.id

  const project = await authed('post', `/organizations/${fx.organizationId}/projects`).send({ name: 'RT Prod' })
  fx.projectId = project.body.data.id

  const key = await authed('post', `/organizations/${fx.organizationId}/projects/${fx.projectId}/api-keys`).send({
    name: 'RT key',
  })
  fx.apiKeySecret = key.body.secret
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('realtime broadcasts', () => {
  it('broadcasts a session transition to organization/project/session channels', async () => {
    MemoryRealtimeDriver.clear()
    const id = await reviewableSession()

    const transitions = MemoryRealtimeDriver.events.filter((e) => e.event === REALTIME_EVENT.sessionTransition)
    expect(transitions.length).toBeGreaterThan(0)

    // The final transition into requires_review fans out to all three channels.
    const last = transitions.at(-1)!
    expect(last.channels).toEqual([
      realtimeChannels.organization(fx.organizationId),
      realtimeChannels.project(fx.organizationId, fx.projectId),
      realtimeChannels.session(id),
    ])
    expect((last.payload as { session_id: string }).session_id).toBe(id)
  })

  it('broadcasts a review action on approve', async () => {
    const id = await reviewableSession()
    MemoryRealtimeDriver.clear()

    const approve = await authed('post', `/organizations/${fx.organizationId}/sessions/${id}/approve`).send({})
    expect(approve.status).toBe(200)

    const review = MemoryRealtimeDriver.events.find(
      (e) => e.event === REALTIME_EVENT.reviewAction && (e.payload as { action: string }).action === 'review.approved',
    )
    expect(review).toBeTruthy()
    expect((review!.payload as { session_id: string }).session_id).toBe(id)
    expect(review!.channels).toContain(realtimeChannels.organization(fx.organizationId))

    // The approve also transitions the session → a transition broadcast too.
    expect(MemoryRealtimeDriver.events.some((e) => e.event === REALTIME_EVENT.sessionTransition)).toBe(true)
  })
})

describe('realtime client glue', () => {
  it('reports the active transport via /config', async () => {
    const res = await request(app).get('/api/v1/realtime/config').set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.transport).toBe('memory')
  })

  it('authorizes an organization channel for a member', async () => {
    const res = await request(app)
      .post('/api/v1/realtime/auth')
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ socket_id: '123.456', channel_name: realtimeChannels.organization(fx.organizationId) })
    expect(res.status).toBe(200)
    expect(typeof res.body.auth).toBe('string')
  })

  it('denies an organization channel to a non-member (403)', async () => {
    const res = await request(app)
      .post('/api/v1/realtime/auth')
      .set('Authorization', `Bearer ${fx.outsiderToken}`)
      .send({ socket_id: '123.456', channel_name: realtimeChannels.organization(fx.organizationId) })
    expect(res.status).toBe(403)
  })
})
