import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { MemoryRealtimeDriver } from '@arkstack/notifications'
import { realtimeChannels, REALTIME_EVENT } from '@arkyc/types'
import { app } from '../src/core/bootstrap'
import { claimDeviceToken } from './helpers/client-token'
import { Organization } from '../src/app/models/Organization'

/** Realtime broadcasts from the transition + review choke points, and channel auth. */
const fx = {
  token: '',
  outsiderToken: '',
  ownerId: '',
  outsiderId: '',
  organizationId: '',
  projectId: '',
  apiKeySecret: '',
}

const authed = (method: 'get' | 'post', path: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${fx.token}`)

const client = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/client/${path}`).set('X-Client-Token', token)

const channelAuth = (token: string, channel: string) =>
  request(app)
    .post('/api/v1/realtime/auth')
    .set('Authorization', `Bearer ${token}`)
    .send({ socket_id: '123.456', channel_name: channel })

const widgetAuth = (clientToken: string, channel: string) =>
  client('post', 'realtime/auth', clientToken).send({ socket_id: '123.456', channel_name: channel })

/** Open a session, returning its id and client token. */
async function openSession(): Promise<{ id: string; token: string }> {
  const open = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send({})

  return { id: open.body.data.id, token: await claimDeviceToken(open.body.client_token) }
}

/** Open a session and walk it to `requires_review` (low document quality). */
async function reviewableSession(): Promise<string> {
  const { id, token } = await openSession()

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
  fx.outsiderId = outsider.body.data.id

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

    const transitions = MemoryRealtimeDriver.broadcasts().filter((e) => e.event === REALTIME_EVENT.sessionTransition)
    expect(transitions.length).toBeGreaterThan(0)

    // The final transition into requires_review fans out to all three channels.
    const last = transitions.at(-1)!
    expect(last.channel).toEqual([
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

    const review = MemoryRealtimeDriver.broadcasts().find(
      (e) => e.event === REALTIME_EVENT.reviewAction && (e.payload as { action: string }).action === 'review.approved',
    )
    expect(review).toBeTruthy()
    expect((review!.payload as { session_id: string }).session_id).toBe(id)
    expect(review!.channel).toContain(realtimeChannels.organization(fx.organizationId))

    // The approve also transitions the session → a transition broadcast too.
    expect(MemoryRealtimeDriver.broadcasts().some((e) => e.event === REALTIME_EVENT.sessionTransition)).toBe(true)
  })
})

describe('dashboard channel auth', () => {
  it('reports the active transport via /config', async () => {
    const res = await request(app).get('/api/v1/realtime/config').set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.transport).toBe('memory')
    expect(res.body.data.channelPrefix).toBe('private-user.')
  })

  it('authorizes an organization channel for a member and denies a non-member', async () => {
    const channel = realtimeChannels.organization(fx.organizationId)

    const member = await channelAuth(fx.token, channel)
    expect(member.status).toBe(200)
    expect(typeof member.body.auth).toBe('string')

    expect((await channelAuth(fx.outsiderToken, channel)).status).toBe(403)
  })

  it('authorizes a project channel only for a project of that organization', async () => {
    expect((await channelAuth(fx.token, realtimeChannels.project(fx.organizationId, fx.projectId))).status).toBe(200)
    expect(
      (await channelAuth(fx.outsiderToken, realtimeChannels.project(fx.organizationId, fx.projectId))).status,
    ).toBe(403)
    expect((await channelAuth(fx.token, realtimeChannels.project(fx.organizationId, fx.organizationId))).status).toBe(
      403,
    )
  })

  it('authorizes a session channel through the session organization', async () => {
    const { id } = await openSession()

    expect((await channelAuth(fx.token, realtimeChannels.session(id))).status).toBe(200)
    expect((await channelAuth(fx.outsiderToken, realtimeChannels.session(id))).status).toBe(403)
  })

  it("authorizes only the caller's own user channel", async () => {
    expect((await channelAuth(fx.token, realtimeChannels.user(fx.ownerId))).status).toBe(200)
    expect((await channelAuth(fx.token, realtimeChannels.user(fx.outsiderId))).status).toBe(403)
  })

  it('denies an unknown channel', async () => {
    expect((await channelAuth(fx.token, 'private-anything')).status).toBe(403)
  })
})

describe('widget channel auth', () => {
  it('hands the widget its session channel with the realtime config', async () => {
    const { id, token } = await openSession()

    const res = await client('get', 'session', token)
    expect(res.body.data.realtime).toMatchObject({ transport: 'memory', channel: realtimeChannels.session(id) })
  })

  it('lets a client token join only its own session channel', async () => {
    const own = await openSession()
    const other = await openSession()

    expect((await widgetAuth(own.token, realtimeChannels.session(own.id))).status).toBe(200)
    expect((await widgetAuth(own.token, realtimeChannels.session(other.id))).status).toBe(403)
    expect((await widgetAuth(own.token, realtimeChannels.organization(fx.organizationId))).status).toBe(403)
  })
})
