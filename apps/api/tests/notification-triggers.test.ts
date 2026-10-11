import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import request from 'parasito'
import { Cache } from '@arkstack/cache'
import { NOTIFICATION_TYPE } from '@arkyc/types'
import { app } from '../src/core/bootstrap'
import { claimDeviceToken } from './helpers/client-token'
import { Organization } from '../src/app/models/Organization'
import { OrganizationInvitation } from '../src/app/models/OrganizationInvitation'
import { OrganizationMember } from '../src/app/models/OrganizationMember'
import { Role } from '../src/app/models/Role'
import { User } from '../src/app/models/User'
import { WebhookDelivery } from '../src/app/models/WebhookDelivery'
import { WebhookEndpoint } from '../src/app/models/WebhookEndpoint'
import { webhookService } from '../src/app/services/WebhookService'

type Account = { id: string; token: string; email: string }
type Listed = { type: string; meta: Record<string, string> | null }

const fx = {
  owner: {} as Account,
  reviewer: {} as Account,
  developer: {} as Account,
  invitee: {} as Account,
  organizationId: '',
  organizationName: '',
  projectId: '',
  apiKeySecret: '',
  endpointId: '',
}
let failingReceiver: http.Server

const as = (account: Account) => ({
  get: (path: string) => request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${account.token}`),
  post: (path: string) => request(app).post(`/api/v1${path}`).set('Authorization', `Bearer ${account.token}`),
  patch: (path: string) => request(app).patch(`/api/v1${path}`).set('Authorization', `Bearer ${account.token}`),
})

const org = (path = '') => `/dashboard/organizations/${fx.organizationId}${path}`

async function register(label: string, stamp: number): Promise<Account> {
  const email = `trg-${label}-${stamp}@test.dev`
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: label, lastname: 'Test', email, password: 'secret123' })

  return { id: res.body.data.id, token: res.body.token, email }
}

async function join(account: Account, roleSlug: string): Promise<void> {
  const role = await Role.where({ organizationId: fx.organizationId, slug: roleSlug }).firstOrFail()

  await OrganizationMember.create({
    organizationId: fx.organizationId,
    userId: account.id,
    roleId: role.id,
    status: 'active',
    joinedAt: new Date(),
  })
}

async function notificationsOf(account: Account, type: string): Promise<Listed[]> {
  const res = await as(account).get('/account/notifications?limit=100')

  return (res.body.data as Listed[]).filter((n) => n.type === type)
}

/** Open a session and walk it to `requires_review`. */
async function reviewableSession(): Promise<string> {
  const open = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send({})
  const token = await claimDeviceToken(open.body.client_token)
  const client = (path: string) => request(app).post(`/api/v1/client/${path}`).set('X-Client-Token', token)

  await request(app).get('/api/v1/client/session').set('X-Client-Token', token)
  await client('document/front').send({ quality_score: 0.4 })
  await client('liveness').send({})
  await client('complete').send({})

  return open.body.data.id
}

beforeAll(async () => {
  failingReceiver = http.createServer((_req, res) => res.writeHead(500).end('down'))
  await new Promise<void>((resolve) => failingReceiver.listen(0, '127.0.0.1', resolve))

  const s = Date.now()
  fx.owner = await register('owner', s)
  fx.reviewer = await register('reviewer', s)
  fx.developer = await register('developer', s)
  fx.invitee = await register('invitee', s)

  fx.organizationName = `Trg Co ${s}`
  const organization = await as(fx.owner).post('/dashboard/organizations').send({ name: fx.organizationName })
  fx.organizationId = organization.body.data.id
  fx.projectId = (await as(fx.owner).post(org('/projects')).send({ name: 'Trg' })).body.data.id
  fx.apiKeySecret = (
    await as(fx.owner)
      .post(org(`/projects/${fx.projectId}/api-keys`))
      .send({ name: 'Trg' })
  ).body.secret

  const port = (failingReceiver.address() as AddressInfo).port
  const endpoint = await as(fx.owner)
    .post(org(`/projects/${fx.projectId}/webhooks`))
    .send({ url: `http://127.0.0.1:${port}/hook`, events: ['verification.approved'] })
  fx.endpointId = endpoint.body.data.id

  await join(fx.reviewer, 'reviewer')
  await join(fx.developer, 'developer')
})

afterAll(async () => {
  await new Promise<void>((resolve) => failingReceiver.close(() => resolve()))
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('review decided', () => {
  it('tells the assignee when someone else decides their session', async () => {
    const id = await reviewableSession()
    await as(fx.owner)
      .post(org(`/sessions/${id}/assign`))
      .send({ user_id: fx.reviewer.id })

    expect(
      (
        await as(fx.owner)
          .post(org(`/sessions/${id}/approve`))
          .send({})
      ).status,
    ).toBe(200)

    const decided = (await notificationsOf(fx.reviewer, NOTIFICATION_TYPE.reviewDecided)).filter(
      (n) => n.meta?.session_id === id,
    )
    expect(decided).toHaveLength(1)
    expect(decided[0]?.meta?.decision).toBe('approved')
  })

  it('stays quiet when the assignee decides it themselves', async () => {
    const id = await reviewableSession()
    await as(fx.owner)
      .post(org(`/sessions/${id}/assign`))
      .send({ user_id: fx.reviewer.id })

    const rejected = await as(fx.reviewer)
      .post(org(`/sessions/${id}/reject`))
      .send({})
    expect(rejected.status).toBe(200)

    const decided = (await notificationsOf(fx.reviewer, NOTIFICATION_TYPE.reviewDecided)).filter(
      (n) => n.meta?.session_id === id,
    )
    expect(decided).toHaveLength(0)
  })
})

describe('webhook failing', () => {
  /** A delivery one attempt away from giving up. */
  const lastAttempt = async (sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') => {
    const endpoint = await WebhookEndpoint.where({ id: fx.endpointId }).firstOrFail()

    return await WebhookDelivery.create({
      organizationId: endpoint.organizationId,
      projectId: endpoint.projectId,
      webhookEndpointId: endpoint.id,
      event: 'verification.approved',
      payload: { event: 'verification.approved', session_id: sessionId } as never,
      status: 'failed',
      attempts: 4,
      nextRetryAt: null,
    })
  }

  const failing = async (account: Account) =>
    (await notificationsOf(account, NOTIFICATION_TYPE.webhookFailing)).filter(
      (n) => n.meta?.endpoint_id === fx.endpointId,
    )

  it('tells webhook maintainers once a delivery exhausts its retries, at most hourly', async () => {
    await Cache.forget(`notifications:webhook-failing:${fx.endpointId}`)

    const delivery = await lastAttempt()
    await expect(webhookService.deliver(delivery.id)).rejects.toThrow()

    expect(await failing(fx.owner)).toHaveLength(1)
    expect(await failing(fx.developer)).toHaveLength(1)
    expect(await failing(fx.reviewer)).toHaveLength(0)

    // A second exhausted delivery within the hour stays quiet.
    await expect(webhookService.deliver((await lastAttempt()).id)).rejects.toThrow()
    expect(await failing(fx.developer)).toHaveLength(1)
  })

  it('ignores test deliveries', async () => {
    await Cache.forget(`notifications:webhook-failing:${fx.endpointId}`)
    const before = (await failing(fx.developer)).length

    const delivery = await lastAttempt('00000000-0000-0000-0000-000000000000')
    await expect(webhookService.deliver(delivery.id)).rejects.toThrow()

    expect(await failing(fx.developer)).toHaveLength(before)
  })
})

describe('invitations', () => {
  const invite = (email: string, roleSlug = 'reviewer') =>
    Role.where({ organizationId: fx.organizationId, slug: roleSlug })
      .firstOrFail()
      .then((role) => as(fx.owner).post(org('/invitations')).send({ email, role_id: role.id }))

  it('notifies an existing user they were invited', async () => {
    const res = await invite(fx.invitee.email)
    expect(res.status).toBe(201)

    const received = (await notificationsOf(fx.invitee, NOTIFICATION_TYPE.invitationReceived)).filter(
      (n) => n.meta?.invitation_id === res.body.data.id,
    )
    expect(received).toHaveLength(1)
  })

  it('still invites an email with no account', async () => {
    expect((await invite(`nobody-${Date.now()}@test.dev`)).status).toBe(201)
  })

  it('requires a verified email to list or accept invitations in-app', async () => {
    expect((await as(fx.invitee).get('/account/invitations')).status).toBe(403)
  })

  it('lists and accepts pending invitations once the email is verified', async () => {
    const user = await User.where({ id: fx.invitee.id }).firstOrFail()
    user.emailVerifiedAt = new Date()
    await user.save()

    const listed = await as(fx.invitee).get('/account/invitations')
    expect(listed.status).toBe(200)
    const pending = (
      listed.body.data as Array<{ id: string; organization: { name: string }; role: { name: string } }>
    )[0]!
    expect(pending.organization.name).toBe(fx.organizationName)
    expect(pending.role.name).toBe('Reviewer')

    const accepted = await as(fx.invitee).patch(`/account/invitations/${pending.id}/accept`).send({})
    expect(accepted.status).toBe(201)

    const member = await OrganizationMember.where({ userId: fx.invitee.id, organizationId: fx.organizationId }).first()
    expect(member).toBeTruthy()
    expect((await OrganizationInvitation.where({ id: pending.id }).firstOrFail()).acceptedAt).toBeTruthy()
    expect((await as(fx.invitee).get('/account/invitations')).body.data).toHaveLength(0)
  })

  it('will not accept an invitation addressed to someone else', async () => {
    const other = await invite(`someone-${Date.now()}@test.dev`)

    expect((await as(fx.invitee).patch(`/account/invitations/${other.body.data.id}/accept`).send({})).status).toBe(404)
  })
})
