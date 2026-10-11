import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'parasito'
import { Broadcast, MemoryRealtimeDriver } from '@arkstack/notifications'
import { NOTIFICATION_TYPE, realtimeChannels } from '@arkyc/types'
import { app } from '../src/core/bootstrap'
import { claimDeviceToken } from './helpers/client-token'
import { Organization } from '../src/app/models/Organization'
import { OrganizationMember } from '../src/app/models/OrganizationMember'
import { Role } from '../src/app/models/Role'
import { User } from '../src/app/models/User'
import { UserPushToken } from '../src/app/models/UserPushToken'
import { PersonalAccessToken } from '../src/app/models/PersonalAccessToken'
import { userNotifier } from '../src/app/notifications/UserNotifier'

type Account = { id: string; token: string }

const fx = {
  owner: { id: '', token: '' } as Account,
  reviewer: { id: '', token: '' } as Account,
  developer: { id: '', token: '' } as Account,
  outsider: { id: '', token: '' } as Account,
  organizationId: '',
  organizationSlug: '',
  projectId: '',
  apiKeySecret: '',
}

const as = (account: Account) => ({
  get: (path: string) => request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${account.token}`),
  post: (path: string) => request(app).post(`/api/v1${path}`).set('Authorization', `Bearer ${account.token}`),
  patch: (path: string) => request(app).patch(`/api/v1${path}`).set('Authorization', `Bearer ${account.token}`),
  delete: (path: string) => request(app).delete(`/api/v1${path}`).set('Authorization', `Bearer ${account.token}`),
})

const client = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/client/${path}`).set('X-Client-Token', token)

async function register(label: string, stamp: number): Promise<Account> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: label, lastname: 'Test', email: `ntf-${label}-${stamp}@test.dev`, password: 'secret123' })

  return { id: res.body.data.id, token: res.body.token }
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

/** Open a session and walk it to `requires_review` (low document quality). */
async function reviewableSession(): Promise<string> {
  const open = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${fx.apiKeySecret}`).send({})
  const { id } = open.body.data
  const token = await claimDeviceToken(open.body.client_token)

  await client('get', 'session', token)
  await client('post', 'document/front', token).send({ quality_score: 0.4 })
  await client('post', 'liveness', token).send({})
  await client('post', 'complete', token).send({})

  return id
}

const notificationsOf = async (account: Account, query = '') =>
  (await as(account).get(`/account/notifications${query}`)).body

beforeAll(async () => {
  const s = Date.now()
  fx.owner = await register('owner', s)
  fx.reviewer = await register('reviewer', s)
  fx.developer = await register('developer', s)
  fx.outsider = await register('outsider', s)

  const organization = await as(fx.owner)
    .post('/dashboard/organizations')
    .send({ name: `Notify Co ${s}` })
  fx.organizationId = organization.body.data.id
  fx.organizationSlug = organization.body.data.slug

  const project = await as(fx.owner)
    .post(`/dashboard/organizations/${fx.organizationId}/projects`)
    .send({ name: 'Notify' })
  fx.projectId = project.body.data.id

  const key = await as(fx.owner)
    .post(`/dashboard/organizations/${fx.organizationId}/projects/${fx.projectId}/api-keys`)
    .send({ name: 'Notify key' })
  fx.apiKeySecret = key.body.secret

  await join(fx.reviewer, 'reviewer')
  await join(fx.developer, 'developer')
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

afterEach(() => vi.restoreAllMocks())

describe('session needs review', () => {
  it('notifies members who can review, and nobody else', async () => {
    MemoryRealtimeDriver.clear()
    const id = await reviewableSession()

    const forOwner = await notificationsOf(fx.owner)
    const forReviewer = await notificationsOf(fx.reviewer)

    for (const body of [forOwner, forReviewer]) {
      const match = body.data.find((n: { meta: { session_id: string } }) => n.meta?.session_id === id)
      expect(match).toMatchObject({
        type: NOTIFICATION_TYPE.sessionNeedsReview,
        title: 'Session needs review',
        action_link: `/o/${fx.organizationSlug}/sessions/${id}`,
        read_at: null,
      })
    }

    expect((await notificationsOf(fx.developer)).data).toHaveLength(0)
    expect((await notificationsOf(fx.outsider)).data).toHaveLength(0)

    // Streamed live on the reviewer's private channel, tagged by session.
    const live = MemoryRealtimeDriver.broadcasts().find(
      (b) => b.channel === realtimeChannels.user(fx.reviewer.id) && b.event === 'notification',
    )
    expect(live?.payload).toMatchObject({ type: NOTIFICATION_TYPE.sessionNeedsReview, tag: `session:${id}` })
  })
})

describe('review assigned', () => {
  it('notifies the assignee', async () => {
    const id = await reviewableSession()

    const res = await as(fx.owner)
      .post(`/dashboard/organizations/${fx.organizationId}/sessions/${id}/assign`)
      .send({ user_id: fx.reviewer.id })
    expect(res.status).toBe(200)

    const assigned = (await notificationsOf(fx.reviewer)).data.filter(
      (n: { type: string; meta: { session_id: string } }) =>
        n.type === NOTIFICATION_TYPE.reviewAssigned && n.meta?.session_id === id,
    )
    expect(assigned).toHaveLength(1)
  })

  it('does not notify someone assigning a session to themselves', async () => {
    const id = await reviewableSession()

    await as(fx.owner)
      .post(`/dashboard/organizations/${fx.organizationId}/sessions/${id}/assign`)
      .send({ user_id: fx.owner.id })

    const assigned = (await notificationsOf(fx.owner)).data.filter(
      (n: { type: string; meta: { session_id: string } }) =>
        n.type === NOTIFICATION_TYPE.reviewAssigned && n.meta?.session_id === id,
    )
    expect(assigned).toHaveLength(0)
  })
})

describe('notifications API', () => {
  it('counts, filters and marks notifications read', async () => {
    const before = await notificationsOf(fx.reviewer)
    expect(before.unread_count).toBeGreaterThan(0)

    const [first] = before.data
    const read = await as(fx.reviewer).patch(`/account/notifications/${first.id}/read`)
    expect(read.status).toBe(201)
    expect(read.body.data.read_at).toBeTruthy()

    const unread = await notificationsOf(fx.reviewer, '?unread=1')
    expect(unread.data.some((n: { id: string }) => n.id === first.id)).toBe(false)
    expect(unread.unread_count).toBe(before.unread_count - 1)

    const all = await as(fx.reviewer).patch('/account/notifications/read')
    expect(all.status).toBe(201)
    expect((await notificationsOf(fx.reviewer)).unread_count).toBe(0)
  })

  it('deletes a notification', async () => {
    const [first] = (await notificationsOf(fx.owner)).data

    expect((await as(fx.owner).delete(`/account/notifications/${first.id}`)).status).toBe(200)
    expect((await notificationsOf(fx.owner)).data.some((n: { id: string }) => n.id === first.id)).toBe(false)
  })

  it("hides another user's notifications (404)", async () => {
    const [mine] = (await notificationsOf(fx.reviewer)).data

    expect((await as(fx.outsider).patch(`/account/notifications/${mine.id}/read`)).status).toBe(404)
    expect((await as(fx.outsider).delete(`/account/notifications/${mine.id}`)).status).toBe(404)
  })
})

describe('notification preferences', () => {
  it('defaults to push on and can turn it off', async () => {
    const shown = await as(fx.developer).get('/account/notification-preferences')
    expect(shown.body.data).toEqual({ push: true })

    const updated = await as(fx.developer).patch('/account/notification-preferences').send({ push: false })
    expect(updated.status).toBe(200)
    expect(updated.body.data).toEqual({ push: false })

    expect((await as(fx.developer).get('/account/notification-preferences')).body.data).toEqual({ push: false })
  })

  it('requires a boolean push flag (422)', async () => {
    expect((await as(fx.developer).patch('/account/notification-preferences').send({})).status).toBe(422)
  })
})

describe('push tokens', () => {
  it('registers a device against the current login and refreshes it in place', async () => {
    const first = await as(fx.outsider)
      .post('/account/push-tokens')
      .send({ token: `device-a-${Date.now()}`, platform: 'web' })
    expect(first.status).toBe(201)
    expect(first.body.data).not.toHaveProperty('token')

    const again = await as(fx.outsider)
      .post('/account/push-tokens')
      .send({ token: 'device-b', platform: 'android', device_name: 'Pixel' })
    expect(again.body.data.id).toBe(first.body.data.id)

    const session = await PersonalAccessToken.query().where({ token: fx.outsider.token }).firstOrFail()
    const rows = (await UserPushToken.query().where({ userId: fx.outsider.id }).get()).all()
    expect(rows).toHaveLength(1)
    expect([rows[0].token, rows[0].platform, rows[0].deviceName, rows[0].personalAccessTokenId]).toEqual([
      'device-b',
      'android',
      'Pixel',
      session.id,
    ])
  })

  it('validates the platform (422)', async () => {
    expect((await as(fx.outsider).post('/account/push-tokens').send({ token: 'x', platform: 'pager' })).status).toBe(
      422,
    )
  })

  it('unregisters the current device', async () => {
    expect((await as(fx.outsider).delete('/account/push-tokens')).status).toBe(200)
    expect(await UserPushToken.query().where({ userId: fx.outsider.id }).count()).toBe(0)
  })
})

describe('push delivery', () => {
  const payload = { type: NOTIFICATION_TYPE.reviewAssigned, title: 'T', description: 'D' }

  // The framework also calls Broadcast.push with no devices on every send; only
  // calls with devices are the notifier's own.
  const devicePushes = (push: { mock: { calls: unknown[][] } }) =>
    push.mock.calls.filter(([tokens]) => (tokens as string[]).length > 0)

  const addDevice = async (account: Account, token: string) => {
    const session = await PersonalAccessToken.query().where({ token: account.token }).firstOrFail()
    await UserPushToken.query().where({ personalAccessTokenId: session.id }).delete()
    await UserPushToken.create({
      userId: account.id,
      personalAccessTokenId: session.id,
      token,
      platform: 'android',
      isActive: true,
      lastRegisteredAt: new Date(),
    })
  }

  const userOf = (account: Account) => User.where({ id: account.id }).firstOrFail()

  it('pushes to active devices and drops tokens the transport rejects', async () => {
    const dead = `dead-${Date.now()}`
    await addDevice(fx.reviewer, dead)
    const push = vi
      .spyOn(Broadcast, 'push')
      .mockImplementation(async (tokens) =>
        tokens.length ? { successCount: 0, failureCount: 1, invalidTokens: [dead] } : null,
      )

    await userNotifier.deliver(await userOf(fx.reviewer), payload)

    expect(devicePushes(push)).toEqual([[[dead], 'notification', expect.objectContaining({ title: 'T' })]])
    expect(await UserPushToken.query().where({ token: dead }).count()).toBe(0)
  })

  it('skips the push for a user who turned it off', async () => {
    await addDevice(fx.developer, `developer-${Date.now()}`)
    const push = vi.spyOn(Broadcast, 'push').mockResolvedValue(null)

    await userNotifier.deliver(await userOf(fx.developer), payload)

    expect(devicePushes(push)).toHaveLength(0)
  })

  it('keeps the stored notification when the push transport fails', async () => {
    await addDevice(fx.reviewer, `live-${Date.now()}`)
    const push = vi.spyOn(Broadcast, 'push').mockImplementation(async (tokens) => {
      if (tokens.length) throw new Error('FCM down')

      return null
    })

    await expect(
      userNotifier.deliver(await userOf(fx.reviewer), { ...payload, title: 'Survives' }),
    ).resolves.toBeUndefined()

    expect(devicePushes(push)).toHaveLength(1)
    const titles = (await notificationsOf(fx.reviewer)).data.map((n: { title: string }) => n.title)
    expect(titles).toContain('Survives')
  })
})
