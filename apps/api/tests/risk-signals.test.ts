import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'parasito'
import { NOTIFICATION_TYPE, type ScreeningHit, type WorkflowStep } from '@arkyc/types'
import { app } from '../src/core/bootstrap'
import { claimDeviceToken } from './helpers/client-token'
import { AuditLog } from '../src/app/models/AuditLog'
import { Organization } from '../src/app/models/Organization'
import { ScreeningMonitor } from '../src/app/models/ScreeningMonitor'
import { SessionClientToken } from '../src/app/models/SessionClientToken'
import { VerificationSession } from '../src/app/models/VerificationSession'
import { screeningDriver } from '../src/app/services/providers'
import { screeningMonitors } from '../src/app/services/risk/ScreeningMonitorService'
import { webhookService } from '../src/app/services/WebhookService'

type Account = { id: string; token: string }

interface Identity {
  reference?: string
  name?: string
  dob?: string
  document?: string
  workflowId?: string
  ip?: string
  selfie?: Buffer
}

interface Detail {
  status: string
  decision_reason: string | null
  risk_signals: Array<{ id: string; key: string; severity: string; source: string; evidence: Record<string, unknown> }>
}

const fx = { owner: {} as Account, organizationId: '', projectId: '', apiKeySecret: '' }

const owner = {
  get: (path: string) => request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${fx.owner.token}`),
  post: (path: string) => request(app).post(`/api/v1${path}`).set('Authorization', `Bearer ${fx.owner.token}`),
  patch: (path: string) => request(app).patch(`/api/v1${path}`).set('Authorization', `Bearer ${fx.owner.token}`),
}

/** A 1x1 PNG, standing in for a selfie. */
const SELFIE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const org = (path = '') => `/dashboard/organizations/${fx.organizationId}${path}`

/** Run a session through the widget with the given identity. */
async function verify(identity: Identity = {}): Promise<string> {
  const open = await request(app)
    .post('/api/v1/sessions')
    .set('Authorization', `Bearer ${fx.apiKeySecret}`)
    .send({ user_reference: identity.reference, workflow_id: identity.workflowId })
  const token = await claimDeviceToken(open.body.client_token)
  const sessionId = open.body.data.id as string

  if (identity.ip) {
    await SessionClientToken.query().where({ sessionId }).updateFrom({ ipAddress: identity.ip })
  }

  const client = (path: string) => request(app).post(`/api/v1/client/${path}`).set('X-Client-Token', token)
  await request(app).get('/api/v1/client/session').set('X-Client-Token', token)
  await client('document/front').send({
    document_type: 'passport',
    country: 'GB',
    full_name: identity.name ?? `Person ${Math.random().toString(36).slice(2, 10).replace(/\d/g, 'x')}`,
    date_of_birth: identity.dob,
    document_number: identity.document ?? `D${Math.random().toString().slice(2, 10)}`,
  })
  const liveness = new FormData()
  if (identity.selfie)
    liveness.append('selfie', new Blob([new Uint8Array(identity.selfie)], { type: 'image/png' }), 'selfie.png')
  await client('liveness').send(liveness)
  await client('complete').send({})

  return sessionId
}

const detail = async (id: string): Promise<Detail> => (await owner.get(org(`/sessions/${id}`))).body.data

async function workflow(steps: WorkflowStep[], options: Record<string, unknown> = {}): Promise<string> {
  const res = await owner.post(org('/workflows')).send({ name: `Risk ${Date.now()}`, steps, options })
  expect(res.status).toBe(201)

  return res.body.data.id
}

const screeningStage = (config: Record<string, unknown>): WorkflowStep[] => [
  { key: 'document', enabled: true },
  { key: 'screening', enabled: true, config: config as never },
  { key: 'liveness', enabled: true },
  { key: 'face_match', enabled: true },
]

beforeAll(async () => {
  const stamp = Date.now()
  const registered = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'Risk', lastname: 'Owner', email: `risk-${stamp}@test.dev`, password: 'secret123' })
  fx.owner = { id: registered.body.data.id, token: registered.body.token }

  fx.organizationId = (await owner.post('/dashboard/organizations').send({ name: `Risk Co ${stamp}` })).body.data.id
  fx.projectId = (await owner.post(org('/projects')).send({ name: 'Risk' })).body.data.id
  fx.apiKeySecret = (await owner.post(org(`/projects/${fx.projectId}/api-keys`)).send({ name: 'Risk' })).body.secret
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

afterEach(() => vi.restoreAllMocks())

describe('duplicate documents', () => {
  it('sends a reused document under a different user to review', async () => {
    const first = await verify({ reference: 'alice', document: 'P7654321' })
    expect((await detail(first)).status).toBe('approved')

    const second = await verify({ reference: 'mallory', document: 'P7654321' })
    const session = await detail(second)
    expect(session.status).toBe('requires_review')
    expect(session.decision_reason).toBe('DUPLICATE_DOCUMENT')
    expect(session.risk_signals.find((s) => s.key === 'duplicate_document')?.evidence.matched_session_ids).toEqual([
      first,
    ])
  })

  it('lets the same user present their document again', async () => {
    await verify({ reference: 'bob', document: 'P1111111', name: 'Bob One', dob: '1980-02-02' })

    expect((await detail(await verify({ reference: 'bob', document: 'P1111111' }))).status).toBe('approved')
  })

  it('flags the same name and birth date under another user as a duplicate identity', async () => {
    await verify({ reference: 'carol', name: 'Carol Dupe', dob: '1985-03-03' })
    const second = await detail(await verify({ reference: 'carla', name: 'carol  DUPE', dob: '1985-03-03' }))

    expect(second.decision_reason).toBe('DUPLICATE_IDENTITY')
  })
})

describe('screening', () => {
  it('sends a sanctions hit to review, visible to reviewers and in the webhook', async () => {
    const workflowId = await workflow(screeningStage({ threshold: 0.7, on_hit: 'review' }))
    const id = await verify({ reference: 'ivan', name: 'Ivan Sanctionov', workflowId })

    const session = await detail(id)
    expect(session.status).toBe('requires_review')
    expect(session.decision_reason).toBe('SANCTIONS_MATCH')
    const signal = session.risk_signals.find((s) => s.key === 'sanctions_match')!
    expect((signal.evidence.hits as ScreeningHit[])[0]).toMatchObject({ entity_id: 'mock-sanction-1' })

    const notices = await owner.get('/account/notifications?limit=100')
    expect(
      (notices.body.data as Array<{ type: string; meta: { session_id?: string } }>).some(
        (n) => n.type === NOTIFICATION_TYPE.screeningHit && n.meta.session_id === id,
      ),
    ).toBe(true)

    const payload = await webhookService.buildPayload(
      await VerificationSession.where({ id }).firstOrFail(),
      'verification.requires_review',
    )
    expect(payload.checks.screening?.hits[0]?.entity_id).toBe('mock-sanction-1')
    expect(payload.checks.risk?.signals).toContainEqual({ key: 'sanctions_match', severity: 'review', cleared: false })
  })

  it('rejects a sanctions hit when the workflow says so', async () => {
    const workflowId = await workflow(screeningStage({ on_hit: 'reject' }))
    const session = await detail(await verify({ reference: 'ivan-2', name: 'Ivan Sanctionov', workflowId }))

    expect(session.status).toBe('rejected')
    expect(session.decision_reason).toBe('SANCTIONS_MATCH')
  })

  it('lets a reviewer clear a false positive, with an audited reason', async () => {
    const workflowId = await workflow(screeningStage({}))
    const id = await verify({ reference: 'paula', name: 'Paula Politico', workflowId })
    const signal = (await detail(id)).risk_signals.find((s) => s.key === 'pep_match')!

    expect((await owner.patch(org(`/sessions/${id}/risk-signals/${signal.id}/clear`)).send({})).status).toBe(422)

    const cleared = await owner
      .patch(org(`/sessions/${id}/risk-signals/${signal.id}/clear`))
      .send({ reason: 'Different date of birth' })
    expect(cleared.status).toBe(201)
    expect(cleared.body.data.clear_reason).toBe('Different date of birth')

    const log = await AuditLog.where({ entityId: id, action: 'risk_signal.cleared' }).first()
    expect(log).toBeTruthy()
  })

  it('reports new watchlist entries for monitored sessions', async () => {
    const workflowId = await workflow(screeningStage({ monitor: true }))
    const id = await verify({ reference: 'dora', name: 'Dora Clean', workflowId })
    expect((await detail(id)).status).toBe('approved')

    const monitor = await ScreeningMonitor.where({ sessionId: id }).firstOrFail()
    monitor.nextScreenAt = new Date(Date.now() - 1000)
    await monitor.save()

    const listed: ScreeningHit = {
      entity_id: 'mock-new-1',
      name: 'Dora Clean',
      score: 0.9,
      category: 'sanction',
      topics: ['sanction'],
      datasets: ['mock_sanctions'],
      birth_dates: [],
      countries: [],
    }
    vi.spyOn(screeningDriver, 'screen').mockResolvedValue({ hits: [listed] })

    await screeningMonitors.runDue()
    await screeningMonitors.runDue()

    const signals = (await detail(id)).risk_signals.filter((s) => s.source === 'monitoring')
    expect(signals).toHaveLength(1)
    expect(signals[0]!.key).toBe('sanctions_match')
  })
})

describe('document checks', () => {
  it('sends an underage holder to review', async () => {
    const workflowId = await workflow(
      [
        { key: 'document', enabled: true },
        { key: 'liveness', enabled: true },
        { key: 'face_match', enabled: true },
      ],
      { min_age: 18 },
    )
    const session = await detail(await verify({ reference: 'kid', dob: '2015-06-01', workflowId }))

    expect(session.decision_reason).toBe('UNDERAGE')
  })

  it('rejects inputs the workflow validation does not know', async () => {
    const res = await owner
      .post(org('/workflows'))
      .send({ name: 'Bad', steps: [{ key: 'document', enabled: true }], options: { risk_policy: { nope: 'reject' } } })

    expect(res.status).toBe(422)
  })
})

describe('device signals', () => {
  it('flags hosting networks and repeat sessions from one address', async () => {
    await owner.patch(org(`/projects/${fx.projectId}`)).send({ settings: { velocity: { max_sessions: 2 } } })

    await verify({ reference: 'v1', ip: '8.8.4.4' })
    await verify({ reference: 'v2', ip: '8.8.4.4' })
    const third = await detail(await verify({ reference: 'v3', ip: '8.8.4.4' }))
    expect(third.decision_reason).toBe('VELOCITY_EXCEEDED')

    const hosted = await detail(await verify({ reference: 'h1', ip: '203.0.113.20' }))
    expect(hosted.decision_reason).toBe('HIGH_RISK_DEVICE')
    expect(hosted.risk_signals.find((s) => s.key === 'high_risk_network')?.evidence.hosting).toBe(true)

    await owner.patch(org(`/projects/${fx.projectId}`)).send({ settings: { velocity: { max_sessions: 1000 } } })
  })
})

describe('face duplicates', () => {
  it('matches the same face under another user once the organization opts in', async () => {
    expect((await detail(await verify({ reference: 'face-a', selfie: SELFIE }))).status).toBe('approved')

    await owner.patch(org()).send({ settings: { face_embeddings: { enabled: true, retention_days: 30 } } })

    expect((await detail(await verify({ reference: 'face-b', selfie: SELFIE }))).status).toBe('approved')
    const third = await detail(await verify({ reference: 'face-c', selfie: SELFIE }))
    expect(third.decision_reason).toBe('DUPLICATE_FACE')

    await owner.patch(org()).send({ settings: { face_embeddings: { enabled: false } } })
  })
})
