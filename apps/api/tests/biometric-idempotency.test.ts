import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { claimDeviceToken } from './helpers/client-token'
import { BiometricJob } from '../src/app/jobs/BiometricJob'
import { FaceMatchCheck } from '../src/app/models/FaceMatchCheck'
import { Organization } from '../src/app/models/Organization'
import { VerificationSession } from '../src/app/models/VerificationSession'

const fx = { token: '', organizationId: '', apiKeySecret: '' }

const authed = (method: 'get' | 'post', path: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${fx.token}`)

const client = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/client/${path}`).set('X-Client-Token', token)

/** Open + complete a session; the sync queue runs OCR → biometric inline. */
async function completeSession(): Promise<string> {
  const open = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send({})
  const token = await claimDeviceToken(open.body.client_token)

  await client('get', 'session', token)
  await client('post', 'document/front', token).send({})
  await client('post', 'liveness', token).send({})
  await client('post', 'complete', token).send({})

  return open.body.data.id
}

beforeAll(async () => {
  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'Bio', lastname: 'Test', email: `bio-${s}@test.dev`, password: 'secret123' })

  fx.token = reg.body.token

  const organization = await authed('post', '/organizations').send({ name: `Bio Co ${s}` })

  fx.organizationId = organization.body.data.id
  const project = await authed('post', `/organizations/${fx.organizationId}/projects`).send({ name: 'Bio Prod' })
  const key = await authed(
    'post',
    `/organizations/${fx.organizationId}/projects/${project.body.data.id}/api-keys`,
  ).send({
    name: 'Bio key',
  })

  fx.apiKeySecret = key.body.secret
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('BiometricJob on retry', () => {
  it('reuses the recorded face match instead of re-running it and duplicating the check', async () => {
    const id = await completeSession()
    const countChecks = async () => Number(await FaceMatchCheck.where({ sessionId: id }).count())

    expect(await countChecks()).toBe(1)

    // A retry of a job that died after recording the face match (the session is
    // still `processing`) must not record it again.
    const session = await VerificationSession.where({ id }).firstOrFail()

    session.status = 'processing'
    session.autoDecision = null
    session.finalDecision = null
    await session.save()

    await new BiometricJob(id).handle()

    expect(await countChecks()).toBe(1)
    const decided = await VerificationSession.where({ id }).firstOrFail()

    expect(decided.status).not.toBe('processing')
  })
})
