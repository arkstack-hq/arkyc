import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { claimDeviceToken } from './helpers/client-token'
import { Organization } from '../src/app/models/Organization'
import { Project } from '../src/app/models/Project'
import { VerificationSession } from '../src/app/models/VerificationSession'

const fx = { token: '', organizationId: '', projectId: '', apiKeySecret: '' }

const authed = (path: string) =>
  request(app).post(`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${fx.token}`)

const claim = (token: string, origin?: string) => {
  const req = request(app).post('/api/v1/client/claim').set('X-Client-Token', token)

  return (origin ? req.set('Origin', origin) : req).send({})
}

const getSession = (token: string, origin?: string) => {
  const req = request(app).get('/api/v1/client/session').set('X-Client-Token', token)

  return origin ? req.set('Origin', origin) : req
}

const handoff = (token: string) => request(app).post('/api/v1/client/handoff').set('X-Client-Token', token).send({})

/** Open a session, returning its id and single-use launch token. */
async function openSession(): Promise<{ id: string; launch: string }> {
  const res = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send({})

  return { id: res.body.data.id, launch: res.body.client_token }
}

async function setProjectSettings(settings: Record<string, unknown>): Promise<void> {
  const project = await Project.where({ id: fx.projectId }).firstOrFail()

  project.settings = { ...(project.settings ?? {}), ...settings } as never
  await project.save()
}

beforeAll(async () => {
  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'CT Owner', lastname: 'Test', email: `ct-${s}@test.dev`, password: 'secret123' })

  fx.token = reg.body.token

  const organization = await authed('/organizations').send({ name: `CT Co ${s}` })

  fx.organizationId = organization.body.data.id

  const project = await authed(`/organizations/${fx.organizationId}/projects`).send({ name: 'CT' })

  fx.projectId = project.body.data.id

  const key = await authed(`/organizations/${fx.organizationId}/projects/${fx.projectId}/api-keys`).send({ name: 'CT' })

  fx.apiKeySecret = key.body.secret
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('launch tokens', () => {
  it('exchange once for a device token that drives the session', async () => {
    const { id, launch } = await openSession()

    const claimed = await claim(launch)

    expect(claimed.status).toBe(201)
    expect(claimed.body.data.token).toEqual(expect.any(String))
    expect(claimed.body.data.token).not.toBe(launch)

    const session = await getSession(claimed.body.data.token)

    expect(session.status).toBe(201)
    expect(session.body.data.id).toBe(id)

    const again = await claim(launch)

    expect(again.status).toBe(409)
    expect(again.body.error).toBe('client_token_used')
  })

  it('never authorize a session call directly', async () => {
    const { launch } = await openSession()

    const res = await getSession(launch)

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_client_token')
  })

  it('can be claimed by only one of two simultaneous requests', async () => {
    const { launch } = await openSession()

    const results = await Promise.all([claim(launch), claim(launch)])

    expect(results.map((res) => res.status).sort()).toEqual([201, 409])
  })

  it('reject claims after the session expires', async () => {
    const { id, launch } = await openSession()
    const session = await VerificationSession.where({ id }).firstOrFail()

    session.expiresAt = new Date(Date.now() - 1000)
    await session.save()

    const res = await claim(launch)

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('session_expired')
  })

  it('are refused as a claim when they are device tokens', async () => {
    const { launch } = await openSession()
    const device = await claimDeviceToken(launch)

    const res = await claim(device)

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_client_token')
  })
})

describe('device tokens', () => {
  it('stay bound to the origin that claimed them', async () => {
    const { launch } = await openSession()
    const device = await claimDeviceToken(launch, 'https://shop.example.com')

    expect((await getSession(device, 'https://shop.example.com')).status).toBe(201)
    expect((await getSession(device, 'HTTPS://SHOP.EXAMPLE.COM/')).status).toBe(201)

    const elsewhere = await getSession(device, 'https://evil.example.com')

    expect(elsewhere.status).toBe(403)
    expect(elsewhere.body.error).toBe('origin_not_allowed')
  })

  it('respect the project origin allowlist when claiming', async () => {
    await setProjectSettings({ allowed_origins: ['https://shop.example.com'] })
    const { launch } = await openSession()

    const blocked = await claim(launch, 'https://evil.example.com')

    expect(blocked.status).toBe(403)
    expect(blocked.body.error).toBe('origin_not_allowed')

    expect((await claim(launch, 'https://shop.example.com')).status).toBe(201)
    await setProjectSettings({ allowed_origins: [] })
  })
})

describe('handoff tokens', () => {
  it('are refused when the project has handoff off', async () => {
    await setProjectSettings({ handoff: { enabled: false } })
    const device = await claimDeviceToken((await openSession()).launch)

    const res = await handoff(device)

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('handoff_disabled')
  })

  it('let a second device claim its own token for the same session', async () => {
    await setProjectSettings({ handoff: { enabled: true } })
    const { id, launch } = await openSession()
    const desktop = await claimDeviceToken(launch, 'https://shop.example.com')

    const minted = await handoff(desktop)

    expect(minted.status).toBe(201)

    // The phone opens the hosted page on another origin.
    const phone = await claimDeviceToken(minted.body.data.token, 'https://verify.arkyc.test')

    expect(phone).not.toBe(desktop)
    expect((await getSession(phone, 'https://verify.arkyc.test')).body.data.id).toBe(id)
    expect((await getSession(desktop, 'https://shop.example.com')).body.data.id).toBe(id)

    expect((await claim(minted.body.data.token)).body.error).toBe('client_token_used')
  })

  it('only honour the newest QR code', async () => {
    await setProjectSettings({ handoff: { enabled: true } })
    const desktop = await claimDeviceToken((await openSession()).launch)

    const first = (await handoff(desktop)).body.data.token
    const second = (await handoff(desktop)).body.data.token

    expect((await claim(first)).body.error).toBe('invalid_client_token')
    expect((await claim(second)).status).toBe(201)
  })

  it('cannot drive the session without being claimed', async () => {
    await setProjectSettings({ handoff: { enabled: true } })
    const desktop = await claimDeviceToken((await openSession()).launch)
    const qr = (await handoff(desktop)).body.data.token

    expect((await getSession(qr)).status).toBe(401)
  })
})
