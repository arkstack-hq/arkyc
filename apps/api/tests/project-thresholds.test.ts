import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { Organization } from '../src/app/models/Organization'
import { Project } from '../src/app/models/Project'

const fx = { token: '', organizationId: '', projectId: '' }

const authed = (method: 'get' | 'post' | 'patch', path: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${fx.token}`)

const update = (thresholds: Record<string, unknown>) =>
  authed('patch', `/organizations/${fx.organizationId}/projects/${fx.projectId}`).send({ thresholds })

const stored = async () => (await Project.where({ id: fx.projectId }).firstOrFail()).settings?.thresholds ?? {}

beforeAll(async () => {
  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'Thr', lastname: 'Test', email: `thr-${s}@test.dev`, password: 'secret123' })

  fx.token = reg.body.token

  const organization = await authed('post', '/organizations').send({ name: `Thr Co ${s}` })

  fx.organizationId = organization.body.data.id
  const project = await authed('post', `/organizations/${fx.organizationId}/projects`).send({ name: 'Thr Prod' })

  fx.projectId = project.body.data.id
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('project verification thresholds', () => {
  it('saves a face-match reject floor', async () => {
    const res = await update({ faceMatchRejectThreshold: 0.3 })

    expect(res.status, res.text).toBe(200)
    expect(await stored()).toMatchObject({ faceMatchRejectThreshold: 0.3 })
  })

  it('rejects a floor above the face-match threshold (it would reject reviewable matches)', async () => {
    const res = await update({ faceMatchThreshold: 0.6, faceMatchRejectThreshold: 0.7 })

    expect(res.status).toBe(422)
  })

  it('saves a liveness reject floor, but not above the liveness threshold', async () => {
    const res = await update({ livenessRejectThreshold: 0.3 })

    expect(res.status, res.text).toBe(200)
    expect(await stored()).toMatchObject({ livenessRejectThreshold: 0.3 })

    expect((await update({ livenessThreshold: 0.5, livenessRejectThreshold: 0.6 })).status).toBe(422)
  })

  it('rejects a score outside 0 to 1', async () => {
    expect((await update({ livenessThreshold: 1.5 })).status).toBe(422)
    expect((await update({ livenessThreshold: 'high' })).status).toBe(422)
  })

  it('clears an override with null and drops unknown keys', async () => {
    await update({ faceMatchRejectThreshold: 0.3, livenessThreshold: 0.9 })

    const res = await update({ faceMatchRejectThreshold: null, notAThreshold: 0.5 })

    expect(res.status, res.text).toBe(200)
    const thresholds = await stored()

    expect(thresholds).not.toHaveProperty('faceMatchRejectThreshold')
    expect(thresholds).not.toHaveProperty('notAThreshold')
    expect(thresholds).toMatchObject({ livenessThreshold: 0.9 })
  })
})
