import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { generateApiKey } from '@arkyc/auth'
import { app } from '../src/core/bootstrap'
import { Tenant } from '../src/app/models/Tenant'
import { Project } from '../src/app/models/Project'
import { ApiKey } from '../src/app/models/ApiKey'
import { VerificationSession } from '../src/app/models/VerificationSession'

/** Phase 6 — verification session engine driven end-to-end via the mock providers. */
const fx = { tenantId: '', projectId: '', apiKeySecret: '' }

const publicApi = (method: 'get' | 'post', path: string) =>
  request(app)[method](`/api/v1/${path}`).set('Authorization', `Bearer ${fx.apiKeySecret}`)

const clientApi = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/client/${path}`).set('X-Client-Token', token)

/** Open a fresh session and return its id + one-time client token. */
async function openSession (): Promise<{ id: string; token: string }> {
  const res = await publicApi('post', 'sessions').send({ user_reference: 'user-123' })
  expect(res.status).toBe(201)
  return { id: res.body.data.id, token: res.body.client_token }
}

/** Walk a session through document + liveness, returning the started token/id. */
async function toLiveness (signals: Record<string, unknown> = {}): Promise<{ id: string; token: string }> {
  const { id, token } = await openSession()
  await clientApi('get', 'session', token)
  await clientApi('post', 'document/front', token).send({ document_type: 'passport', ...signals })
  await clientApi('post', 'liveness', token).send(signals)
  return { id, token }
}

beforeAll(async () => {
  const s = Date.now()
  const tenant = await Tenant.create({ name: 'Sess Co', slug: `sess-${s}`, settings: {} })
  fx.tenantId = tenant.id
  const project = await Project.create({
    tenantId: tenant.id,
    name: 'Sess Prod',
    slug: `sess-prod-${s}`,
    environment: 'production',
    settings: {},
    branding: {},
    status: 'active',
  })
  fx.projectId = project.id

  const key = generateApiKey('live')
  fx.apiKeySecret = key.secret
  await ApiKey.create({
    tenantId: tenant.id,
    projectId: project.id,
    name: 'Sess key',
    keyPrefix: key.keyPrefix,
    keyHash: key.keyHash,
  })
})

afterAll(async () => {
  if (fx.tenantId) await Tenant.destroy(fx.tenantId)
})

describe('verification session lifecycle', () => {
  it('creates a session with a one-time client token', async () => {
    const res = await publicApi('post', 'sessions').send({ user_reference: 'abc' })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.project_id).toBe(fx.projectId)
    expect(res.body.client_token).toBeTruthy()
  })

  it('walks a clean session to approved', async () => {
    const { id, token } = await toLiveness()
    const complete = await clientApi('post', 'complete', token).send({})
    expect(complete.status).toBe(200)
    expect(complete.body.data.status).toBe('approved')

    const show = await publicApi('get', `sessions/${id}`)
    expect(show.body.data.final_decision).toBe('approved')
    expect(show.body.data.decision_reason).toBe('AUTO_APPROVED')
    expect(show.body.data.completed_at).toBeTruthy()
    expect(show.body.data.risk_score).not.toBeNull()
  })

  it('advances status through each step', async () => {
    const { token } = await openSession()
    expect((await clientApi('get', 'session', token)).body.data.status).toBe('started')
    expect((await clientApi('post', 'document/front', token).send({})).body.data.status).toBe('document_submitted')
    expect((await clientApi('post', 'liveness', token).send({})).body.data.status).toBe('liveness_submitted')
    expect((await clientApi('post', 'complete', token).send({})).body.data.status).toBe('approved')
  })

  it('rejects an expired document', async () => {
    const { id, token } = await toLiveness({ expired: true })
    const complete = await clientApi('post', 'complete', token).send({})
    expect(complete.body.data.status).toBe('rejected')

    const show = await publicApi('get', `sessions/${id}`)
    expect(show.body.data.final_decision).toBe('rejected')
    expect(show.body.data.decision_reason).toBe('DOCUMENT_EXPIRED')
  })

  it('routes low document quality to manual review', async () => {
    const { id, token } = await toLiveness({ quality_score: 0.4 })
    const complete = await clientApi('post', 'complete', token).send({})
    expect(complete.body.data.status).toBe('requires_review')

    const show = await publicApi('get', `sessions/${id}`)
    expect(show.body.data.auto_decision).toBe('requires_review')
    expect(show.body.data.final_decision).toBeNull()
    expect(show.body.data.decision_reason).toBe('LOW_DOCUMENT_QUALITY')
  })

  it('cancels a session and blocks further mutation', async () => {
    const { id, token } = await openSession()
    const cancel = await publicApi('post', `sessions/${id}/cancel`)
    expect(cancel.body.data.status).toBe('cancelled')

    const blocked = await clientApi('post', 'document/front', token).send({})
    expect(blocked.status).toBe(409)
  })

  it('scopes session lookups to the owning project (404 otherwise)', async () => {
    await publicApi('get', 'sessions/00000000-0000-0000-0000-000000000000').expect(404)
  })

  it('lazily expires a session past its TTL', async () => {
    const { id } = await openSession()
    const row = await VerificationSession.where({ id }).firstOrFail()
    row.expiresAt = new Date(Date.now() - 1000)
    await row.save()

    const show = await publicApi('get', `sessions/${id}`)
    expect(show.body.data.status).toBe('expired')
  })

  it('enforces the liveness retry limit', async () => {
    const { token } = await toLiveness() // attempt 1
    expect((await clientApi('post', 'liveness', token).send({})).status).toBe(200) // 2
    expect((await clientApi('post', 'liveness', token).send({})).status).toBe(200) // 3
    const blocked = await clientApi('post', 'liveness', token).send({}) // 4 → over limit
    expect(blocked.status).toBe(429)
  })
})
