import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Organization } from '../src/app/models/Organization'
import { app } from '../src/core/bootstrap'
import request from 'parasito'

const fx = { token: '', organizationId: '' }

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
