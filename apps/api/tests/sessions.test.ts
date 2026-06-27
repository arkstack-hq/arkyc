import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApiKey } from '../src/app/models/ApiKey'
import { Project } from '../src/app/models/Project'
import { Storage } from '@arkstack/filesystem'
import { Organization } from '../src/app/models/Organization'
import { VerificationSession } from '../src/app/models/VerificationSession'
import { app } from '../src/core/bootstrap'
import { ApiKey as ApiKeyAuth } from '@arkyc/auth'
import request from 'parasito'

/** Phase 8 — verification session engine driven async via the queue + workers. */
const fx = { organizationId: '', projectId: '', apiKeySecret: '' }

/** A second project configured for the active-liveness flow (Phase 17). */
const active = { projectId: '', apiKeySecret: '' }

const publicApi = (method: 'get' | 'post', path: string) =>
  request(app)[method](`/api/v1/${path}`).set('Authorization', `Bearer ${fx.apiKeySecret}`)

const activeApi = (method: 'get' | 'post', path: string) =>
  request(app)[method](`/api/v1/${path}`).set('Authorization', `Bearer ${active.apiKeySecret}`)

const clientApi = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/client/${path}`).set('X-Client-Token', token)

/** Open a fresh session and return its id + one-time client token. */
async function openSession(): Promise<{ id: string; token: string }> {
  const res = await publicApi('post', 'sessions').send({ user_reference: 'user-123' })
  expect(res.status).toBe(201)

  return { id: res.body.data.id, token: res.body.client_token }
}

/** Walk a session through document + liveness, returning the started token/id. */
async function toLiveness(signals: Record<string, unknown> = {}): Promise<{ id: string; token: string }> {
  const { id, token } = await openSession()
  await clientApi('get', 'session', token)
  await clientApi('post', 'document/front', token).send({ document_type: 'passport', ...signals })
  await clientApi('post', 'liveness', token).send(signals)

  return { id, token }
}

beforeAll(async () => {
  const s = Date.now()
  const organization = await Organization.create({ name: 'Sess Co', slug: `sess-${s}`, settings: {} })
  fx.organizationId = organization.id
  const project = await Project.create({
    organizationId: organization.id,
    name: 'Sess Prod',
    slug: `sess-prod-${s}`,
    environment: 'production',
    // Pin passive so the capture-model assertions don't depend on the shared
    // global-settings singleton (other suites mutate it to `active`). Opt into
    // cross-device handoff (and forbid desktop continue) so the bootstrap surfaces it.
    settings: { capture_model: 'passive', handoff: { enabled: true, allow_desktop: false } },
    branding: { primary_color: '#112233', name: 'Sess Co' },
    status: 'active',
  })
  fx.projectId = project.id

  const key = ApiKeyAuth.generate('live')
  fx.apiKeySecret = key.secret
  await ApiKey.create({
    organizationId: organization.id,
    projectId: project.id,
    name: 'Sess key',
    keyPrefix: key.keyPrefix,
    keyHash: key.keyHash,
  })

  // A project that overrides the capture model to active liveness.
  const activeProject = await Project.create({
    organizationId: organization.id,
    name: 'Active Prod',
    slug: `active-prod-${s}`,
    environment: 'production',
    settings: { capture_model: 'active' },
    branding: {},
    status: 'active',
  })
  active.projectId = activeProject.id
  const activeKey = ApiKeyAuth.generate('live')
  active.apiKeySecret = activeKey.secret
  await ApiKey.create({
    organizationId: organization.id,
    projectId: activeProject.id,
    name: 'Active key',
    keyPrefix: activeKey.keyPrefix,
    keyHash: activeKey.keyHash,
  })
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('verification session lifecycle', () => {
  it('creates a session with a one-time client token', async () => {
    const res = await publicApi('post', 'sessions').send({ user_reference: 'abc' })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.project_id).toBe(fx.projectId)
    expect(res.body.client_token).toBeTruthy()
  })

  it('rejects an unknown workflow_id with a stable error key (from the service layer)', async () => {
    const res = await publicApi('post', 'sessions').send({
      user_reference: 'abc',
      workflow_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(res.status).toBe(422)
    expect(res.body.error).toBe('invalid_workflow')
  })

  it('walks a clean session to approved via the workers', async () => {
    const { id, token } = await toLiveness()
    const complete = await clientApi('post', 'complete', token).send({})
    expect(complete.status).toBe(202)
    // Decision is async — completing only moves the session to `processing`.
    expect(complete.body.data.status).toBe('processing')

    const show = await publicApi('get', `sessions/${id}`)
    expect(show.body.data.status).toBe('approved')
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
    expect((await clientApi('post', 'complete', token).send({})).body.data.status).toBe('processing')

    expect((await clientApi('get', 'session', token)).body.data.status).toBe('approved')
  })

  it('rejects an expired document', async () => {
    const { id, token } = await toLiveness({ expired: true })
    await clientApi('post', 'complete', token).send({})

    const show = await publicApi('get', `sessions/${id}`)
    expect(show.body.data.status).toBe('rejected')
    expect(show.body.data.final_decision).toBe('rejected')
    expect(show.body.data.decision_reason).toBe('DOCUMENT_EXPIRED')
  })

  it('routes low document quality to manual review', async () => {
    const { id, token } = await toLiveness({ quality_score: 0.4 })
    await clientApi('post', 'complete', token).send({})

    const show = await publicApi('get', `sessions/${id}`)
    expect(show.body.data.status).toBe('requires_review')
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

  it('stores a multipart-uploaded document via Arkstack Storage', async () => {
    const { id, token } = await openSession()
    await clientApi('get', 'session', token)

    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]) // JPEG header
    const form = new FormData()
    form.append('image', new Blob([bytes], { type: 'image/jpeg' }), 'front.jpg')
    await clientApi('post', 'document/front', token).send(form)

    const key = `organizations/${fx.organizationId}/projects/${fx.projectId}/sessions/${id}/documents/front.jpg`
    expect(await Storage.disk().exists(key)).toBe(true)
    expect(Buffer.from(await Storage.disk().getBytes(key)).equals(bytes)).toBe(true)
  })

  it('rejects an invalid document_type', async () => {
    const { token } = await openSession()
    await clientApi('get', 'session', token)
    const res = await clientApi('post', 'document/front', token).send({
      document_type: 'nonsense',
    })
    expect(res.status).toBe(422)
  })

  it('enforces the liveness retry limit', async () => {
    const { token } = await toLiveness() // attempt 1
    expect((await clientApi('post', 'liveness', token).send({})).status).toBe(201) // 2
    expect((await clientApi('post', 'liveness', token).send({})).status).toBe(201) // 3
    const blocked = await clientApi('post', 'liveness', token).send({}) // 4 → over limit
    expect(blocked.status).toBe(429)
  })

  it('a passive project issues no liveness challenges', async () => {
    const { token } = await openSession()
    const boot = await clientApi('get', 'session', token)
    expect(boot.body.data.capture_model).toBe('passive')
    expect(boot.body.data.liveness_challenges).toEqual([])
  })

  it('exposes the project cross-device handoff config in the bootstrap', async () => {
    const { token } = await openSession()
    const boot = await clientApi('get', 'session', token)
    expect(boot.body.data.handoff).toMatchObject({ enabled: true, allow_desktop: false })
    // The handoff destination is a first-party hosted page (no integrator setup).
    expect(boot.body.data.handoff.url).toMatch(/\/verify$/)
  })

  it('exposes realtime connection info scoped to the session', async () => {
    const { id, token } = await openSession()
    const boot = await clientApi('get', 'session', token)
    // Transport is `memory` in tests; the widget learns its own session channel.
    expect(boot.body.data.realtime).toMatchObject({ transport: 'memory', channel: `private-session-${id}` })
  })

  it('exposes the project branding so the widget themes itself', async () => {
    const { token } = await openSession()
    const boot = await clientApi('get', 'session', token)
    expect(boot.body.data.branding).toMatchObject({ primary_color: '#112233', name: 'Sess Co' })
  })

  it('lets a client token sign only its own session channel', async () => {
    const { id, token } = await openSession()
    // A foreign session channel is forbidden for this token.
    const foreign = await clientApi('post', 'realtime/auth', token).send({
      socket_id: '123.456',
      channel_name: 'private-session-someone-else',
    })
    expect(foreign.status).toBe(403)

    // A organization channel is never client-signable, even one's own organization.
    const organization = await clientApi('post', 'realtime/auth', token).send({
      socket_id: '123.456',
      channel_name: 'private-organization-x',
    })
    expect(organization.status).toBe(403)

    // The session's own channel passes scope and is signed.
    const own = await clientApi('post', 'realtime/auth', token).send({
      socket_id: '123.456',
      channel_name: `private-session-${id}`,
    })
    expect(own.status).toBe(200)
    expect(own.body.auth).toBeTruthy()
  })
})

describe('active liveness (Phase 17)', () => {
  const openActive = async (): Promise<{ id: string; token: string }> => {
    const res = await activeApi('post', 'sessions').send({})
    expect(res.status).toBe(201)

    return { id: res.body.data.id, token: res.body.client_token }
  }

  it('issues a randomized challenge sequence in the bootstrap', async () => {
    const { token } = await openActive()
    const boot = await clientApi('get', 'session', token)
    expect(boot.body.data.capture_model).toBe('active')
    expect(Array.isArray(boot.body.data.liveness_challenges)).toBe(true)
    expect(boot.body.data.liveness_challenges).toHaveLength(3)
  })

  it('defaults handoff to disabled when the project has not opted in', async () => {
    const { token } = await openActive()
    const boot = await clientApi('get', 'session', token)
    expect(boot.body.data.handoff).toMatchObject({ enabled: false, allow_desktop: true })
  })

  it('passes when the performed sequence matches the issued one', async () => {
    const { id, token } = await openActive()
    const boot = await clientApi('get', 'session', token)
    const challenges = boot.body.data.liveness_challenges as string[]

    await clientApi('post', 'document/front', token).send({ document_type: 'passport' })
    const live = await clientApi('post', 'liveness', token).send({
      mode: 'active',
      challenges: JSON.stringify(challenges),
    })
    expect(live.status).toBe(201)
    await clientApi('post', 'complete', token).send({})

    const show = await activeApi('get', `sessions/${id}`)
    expect(show.body.data.status).toBe('approved')
  })

  it('fails when the performed sequence does not match (replay)', async () => {
    const { id, token } = await openActive()
    await clientApi('get', 'session', token)
    await clientApi('post', 'document/front', token).send({ document_type: 'passport' })

    const live = await clientApi('post', 'liveness', token).send({
      mode: 'active',
      challenges: JSON.stringify(['blink', 'blink', 'blink']),
    })
    expect(live.status).toBe(201)
    await clientApi('post', 'complete', token).send({})

    const show = await activeApi('get', `sessions/${id}`)
    expect(show.body.data.status).toBe('rejected')
    expect(show.body.data.decision_reason).toMatch(/LIVENESS/)
  })
})
