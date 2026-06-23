import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Organization } from '../src/app/models/Organization'
import { app } from '../src/core/bootstrap'
import request from 'parasito'

const fx = { token: '', organizationId: '', projectId: '', apiKeySecret: '' }

const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${fx.token}`)

const wf = (method: 'get' | 'post' | 'patch' | 'delete', path = '') =>
  authed(method, `/organizations/${fx.organizationId}/workflows${path}`)

beforeAll(async () => {
  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'Wf', lastname: 'Owner', email: `wf-${s}@test.dev`, password: 'secret123' })
  fx.token = reg.body.token

  const organization = await authed('post', '/organizations').send({ name: `Wf Co ${s}` })
  fx.organizationId = organization.body.data.id

  const project = await authed('post', `/organizations/${fx.organizationId}/projects`).send({ name: 'Wf Prod' })
  fx.projectId = project.body.data.id
  const key = await authed(
    'post',
    `/organizations/${fx.organizationId}/projects/${fx.projectId}/api-keys`,
  ).send({ name: 'Wf key' })
  fx.apiKeySecret = key.body.secret
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('workflows CRUD', () => {
  it('creates a workflow, preserving order and appending omitted stages as disabled', async () => {
    const res = await wf('post').send({
      name: 'Selfie first, capture only',
      // liveness before document, face_match omitted, OCR skipped
      steps: [
        { key: 'liveness', enabled: true },
        { key: 'document', enabled: true },
      ],
      options: { skip_ocr: true },
    })
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBeTruthy()
    expect(res.body.data.steps).toEqual([
      { key: 'liveness', enabled: true },
      { key: 'document', enabled: true },
      { key: 'face_match', enabled: false },
    ])
    expect(res.body.data.options).toEqual({ skip_ocr: true })
  })

  it('rejects a workflow with every stage disabled', async () => {
    const res = await wf('post').send({
      name: 'All off',
      steps: [
        { key: 'document', enabled: false },
        { key: 'liveness', enabled: false },
        { key: 'face_match', enabled: false },
      ],
    })
    expect(res.status).toBe(422)
  })

  it('rejects an unknown stage key', async () => {
    const res = await wf('post').send({
      name: 'Bad',
      steps: [{ key: 'teleport', enabled: true }],
    })
    expect(res.status).toBe(422)
  })

  it('lists, shows, updates, and deletes a workflow', async () => {
    const created = await wf('post').send({
      name: 'Standard',
      steps: [
        { key: 'document', enabled: true },
        { key: 'liveness', enabled: true },
        { key: 'face_match', enabled: true },
      ],
    })
    const id = created.body.data.id
    expect(created.body.data.options).toEqual({ skip_ocr: false })

    const list = await wf('get')
    expect(list.status).toBe(200)
    expect(list.body.data.some((w: { id: string }) => w.id === id)).toBe(true)

    const show = await wf('get', `/${id}`)
    expect(show.status).toBe(200)
    expect(show.body.data.name).toBe('Standard')

    const updated = await wf('patch', `/${id}`).send({
      name: 'Standard (no face match)',
      steps: [
        { key: 'document', enabled: true },
        { key: 'liveness', enabled: true },
        { key: 'face_match', enabled: false },
      ],
      options: { skip_ocr: false },
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.name).toBe('Standard (no face match)')
    expect(updated.body.data.steps.find((x: { key: string }) => x.key === 'face_match').enabled).toBe(false)

    const del = await wf('delete', `/${id}`)
    expect(del.status).toBe(200)

    const after = await wf('get')
    expect(after.body.data.some((w: { id: string }) => w.id === id)).toBe(false)
  })

  it('returns 404 for an unknown workflow id', async () => {
    const res = await wf('get', '/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })

  it('denies access without authentication', async () => {
    await request(app).get(`/api/v1/dashboard/organizations/${fx.organizationId}/workflows`).expect(401)
  })
})

describe('applying a workflow to a session', () => {
  async function createWorkflow(): Promise<string> {
    const res = await wf('post').send({
      name: 'Capture only',
      steps: [
        { key: 'document', enabled: true },
        { key: 'liveness', enabled: false },
        { key: 'face_match', enabled: false },
      ],
      options: { skip_ocr: true },
    })

    return res.body.data.id
  }

  const openSession = (body: Record<string, unknown>) =>
    request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send(body)

  it('snapshots the workflow onto the session and exposes it to the widget', async () => {
    const workflowId = await createWorkflow()

    const open = await openSession({ workflow_id: workflowId })
    expect(open.status).toBe(201)
    expect(open.body.data.workflow_id).toBe(workflowId)
    expect(open.body.data.workflow.options).toEqual({ skip_ocr: true })

    // The widget's client-session view carries the resolved workflow.
    const clientView = await request(app)
      .get('/api/v1/client/session')
      .set('X-Client-Token', open.body.client_token)
    expect(clientView.status).toBe(201)
    expect(clientView.body.data.workflow.steps).toEqual([
      { key: 'document', enabled: true },
      { key: 'liveness', enabled: false },
      { key: 'face_match', enabled: false },
    ])
  })

  it('runs the default pipeline (null workflow) when none is passed', async () => {
    const open = await openSession({})
    expect(open.status).toBe(201)
    expect(open.body.data.workflow_id).toBeNull()
    expect(open.body.data.workflow).toBeNull()
  })

  it('rejects a workflow_id that does not belong to the organization', async () => {
    const open = await openSession({ workflow_id: '00000000-0000-0000-0000-000000000000' })
    expect(open.status).toBe(422)
  })
})

describe('workflow-driven pipeline (jobs run inline in tests)', () => {
  const client = (method: 'get' | 'post', path: string, token: string) =>
    request(app)[method](`/api/v1/client/${path}`).set('X-Client-Token', token)

  const openSession = (body: Record<string, unknown>) =>
    request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send(body)

  async function makeWorkflow(name: string, steps: unknown, options?: unknown): Promise<string> {
    const res = await wf('post').send({ name, steps, options })

    return res.body.data.id
  }

  const retrieve = (id: string) =>
    request(app).get(`/api/v1/sessions/${id}`).set('Authorization', `Bearer ${fx.apiKeySecret}`)

  it('completes a capture-only workflow with no liveness, no OCR, no face match', async () => {
    const workflowId = await makeWorkflow(
      'Capture only',
      [
        { key: 'document', enabled: true },
        { key: 'liveness', enabled: false },
        { key: 'face_match', enabled: false },
      ],
      { skip_ocr: true },
    )

    const open = await openSession({ workflow_id: workflowId })
    const token = open.body.client_token
    await client('get', 'session', token)
    await client('post', 'document/front', token).send({})
    // No liveness step — complete straight after the document.
    const done = await client('post', 'complete', token).send({})
    expect(done.status).toBe(202)

    const final = await retrieve(open.body.data.id)
    expect(final.body.data.status).toBe('approved')
  })

  it('completes a face-match-disabled workflow using only document + liveness', async () => {
    const workflowId = await makeWorkflow('No face match', [
      { key: 'document', enabled: true },
      { key: 'liveness', enabled: true },
      { key: 'face_match', enabled: false },
    ])

    const open = await openSession({ workflow_id: workflowId })
    const token = open.body.client_token
    await client('get', 'session', token)
    await client('post', 'document/front', token).send({})
    await client('post', 'liveness', token).send({})
    const done = await client('post', 'complete', token).send({})
    expect(done.status).toBe(202)

    const final = await retrieve(open.body.data.id)
    expect(final.body.data.status).toBe('approved')
  })

  it('exposes signed asset URLs on retrieve and gates them by signature', async () => {
    const open = await openSession({})
    const token = open.body.client_token
    await client('get', 'session', token)
    await client('post', 'document/front', token).send({})

    const final = await retrieve(open.body.data.id)
    const url: string = final.body.data.assets.document_front
    expect(url).toContain(`/api/v1/session-assets/${open.body.data.id}/document_front`)

    const parsed = new URL(url)
    const signedPath = parsed.pathname + parsed.search

    // A valid signature passes the gate (mock assets are empty, so it 404s on
    // the bytes rather than 403-ing on the signature).
    const valid = await request(app).get(signedPath)
    expect(valid.status).not.toBe(403)

    // A tampered signature is rejected.
    const tampered = signedPath.replace(/signature=[a-f0-9]+/, 'signature=deadbeefdeadbeef')
    const bad = await request(app).get(tampered)
    expect(bad.status).toBe(403)
  })
})
