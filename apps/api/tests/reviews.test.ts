import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { Organization } from '../src/app/models/Organization'

/** Phase 9 — human review of `requires_review` sessions + the audit trail. */
const fx = { token: '', ownerId: '', organizationId: '', projectId: '', apiKeySecret: '' }

const authed = (method: 'get' | 'post' | 'patch', path: string) =>
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
    .send({
      firstname: 'Rev Owner',
      lastname: 'Test',
      email: `rev-${s}@test.dev`,
      password: 'secret123',
    })
  fx.token = reg.body.token
  fx.ownerId = reg.body.data.id

  const organization = await authed('post', '/organizations').send({ name: `Rev Co ${s}` })
  fx.organizationId = organization.body.data.id

  const project = await authed('post', `/organizations/${fx.organizationId}/projects`).send({
    name: 'Rev Prod',
  })
  fx.projectId = project.body.data.id

  const key = await authed('post', `/organizations/${fx.organizationId}/projects/${fx.projectId}/api-keys`).send({
    name: 'Rev key',
  })
  fx.apiKeySecret = key.body.secret
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('review queue + actions', () => {
  it('lands a low-quality session in requires_review and lists it', async () => {
    const id = await reviewableSession()

    const list = await authed('get', `/organizations/${fx.organizationId}/sessions?status=requires_review`)
    expect(list.status).toBe(200)
    const found = list.body.data.find((row: { id: string }) => row.id === id)
    expect(found.auto_decision).toBe('requires_review')
  })

  it('exposes a detailed session (ocr + checks + media) and streams an artifact', async () => {
    const id = await reviewableSession()

    const detail = await authed('get', `/organizations/${fx.organizationId}/sessions/${id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data).toHaveProperty('ocr')
    expect(detail.body.data).toHaveProperty('liveness')
    expect(Array.isArray(detail.body.data.media)).toBe(true)
    expect(detail.body.data.media).toContain('document_front')

    const media = await authed('get', `/organizations/${fx.organizationId}/sessions/${id}/media/document_front`)
    expect(media.status).toBe(200)

    const missing = await authed('get', `/organizations/${fx.organizationId}/sessions/${id}/media/bogus`)
    expect(missing.status).toBe(404)
  })

  it('approves a session and records the audit trail', async () => {
    const id = await reviewableSession()

    const approve = await authed('post', `/organizations/${fx.organizationId}/sessions/${id}/approve`).send({
      reason: 'looks ok',
    })
    expect(approve.status).toBe(200)
    expect(approve.body.data.status).toBe('approved')
    expect(approve.body.data.final_decision).toBe('approved')
    expect(approve.body.data.decision_reason).toBe('MANUAL_APPROVAL')

    const logs = await authed('get', `/organizations/${fx.organizationId}/audit-logs?action=review.approved`)
    expect(logs.status).toBe(200)
    expect(logs.body.data.some((l: { entity_id: string }) => l.entity_id === id)).toBe(true)
  })

  it('rejects a session', async () => {
    const id = await reviewableSession()

    const reject = await authed('post', `/organizations/${fx.organizationId}/sessions/${id}/reject`).send({})
    expect(reject.body.data.status).toBe('rejected')
    expect(reject.body.data.decision_reason).toBe('MANUAL_REJECTION')
  })

  it('sends a session back for a document retry', async () => {
    const id = await reviewableSession()

    const retry = await authed('post', `/organizations/${fx.organizationId}/sessions/${id}/request-retry`).send({
      kind: 'document',
    })
    expect(retry.body.data.status).toBe('started')
  })

  it('lets a manager override an already-finalized decision', async () => {
    const id = await reviewableSession()
    await authed('post', `/organizations/${fx.organizationId}/sessions/${id}/approve`).send({})
    // Full override: a finalized (approved) session can be re-decided to rejected.
    const override = await authed('post', `/organizations/${fx.organizationId}/sessions/${id}/reject`).send({ reason: 'override' })
    expect(override.status).toBe(200)
    expect(override.body.data.final_decision).toBe('rejected')
  })

  it('assigns a session to a reviewer', async () => {
    const id = await reviewableSession()

    const res = await authed('post', `/organizations/${fx.organizationId}/sessions/${id}/assign`).send({
      user_id: fx.ownerId,
    })
    expect(res.status).toBe(200)
    expect(res.body.data.assigned_to).toBe(fx.ownerId)

    const logs = await authed('get', `/organizations/${fx.organizationId}/audit-logs?action=review.assigned`)
    expect(logs.body.data.some((l: { entity_id: string }) => l.entity_id === id)).toBe(true)
  })

  it('flags a session as suspicious', async () => {
    const id = await reviewableSession()

    const res = await authed('post', `/organizations/${fx.organizationId}/sessions/${id}/suspicious`).send({
      reason: 'face mismatch',
    })
    expect(res.status).toBe(200)

    const logs = await authed('get', `/organizations/${fx.organizationId}/audit-logs?action=review.suspicious`)
    expect(logs.body.data.some((l: { entity_id: string }) => l.entity_id === id)).toBe(true)
  })

  it('captures the session lifecycle in the audit log', async () => {
    for (const action of ['session.created', 'session.auto_decided']) {
      const logs = await authed('get', `/organizations/${fx.organizationId}/audit-logs?action=${action}`)
      expect(logs.body.data.length).toBeGreaterThan(0)
    }
  })

  it('captures dashboard CRUD in the audit log (retro-fill)', async () => {
    for (const action of ['organization.created', 'project.created', 'api_key.created']) {
      const logs = await authed('get', `/organizations/${fx.organizationId}/audit-logs?action=${action}`)
      expect(logs.body.data.length).toBeGreaterThan(0)
    }
  })
})
