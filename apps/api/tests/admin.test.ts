import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'
import { Role } from '../src/app/models/Role'
import { AdminPermission } from '../src/app/models/AdminPermission'
import { GlobalSetting } from '../src/app/models/GlobalSetting'
import { User } from '../src/app/models/User'

/** Platform super-admin tier above tenants (Phase 15): canAdmin + global settings. */
const ctx = { ownerToken: '', ownerId: '', userToken: '', userId: '' }

const register = (s: number, tag: string) =>
  request(app)
    .post('/api/v1/auth/register')
    .send({
      firstname: tag,
      lastname: 'Test',
      email: `${tag}-${s}@test.dev`,
      password: 'secret123',
    })

const admin = (method: 'get' | 'patch' | 'post' | 'delete', path: string, token: string) =>
  request(app)[method](`/api/v1/admin${path}`).set('Authorization', `Bearer ${token}`)

/** Delete the singleton settings row (Arkormˣ forbids unconditional deletes). */
const resetSettings = async () => {
  const row = await GlobalSetting.query().first()
  if (row) await row.delete()
}

beforeAll(async () => {
  const s = Date.now()

  // The settings row is a platform singleton that persists across runs — reset
  // it so the "merged over defaults" assertions are deterministic.
  await resetSettings()

  const owner = await register(s, 'plat-owner')
  ctx.ownerToken = owner.body.token
  ctx.ownerId = owner.body.data.id

  const user = await register(s, 'tenant-user')
  ctx.userToken = user.body.token
  ctx.userId = user.body.data.id

  // "Sync ownership": ensure the admin catalogue/role exist, then grant the
  // first user the platform-owner role (what `ark admin:grant` does).
  await PermissionSync.adminPermissions(permissionStore)
  await PermissionSync.adminRoles(permissionStore)
  const role = await Role.where({
    slug: AdminRoles.bySlug('platform-owner').slug,
    admin: true,
  }).first()
  await AdminPermission.create({ userId: ctx.ownerId, roleId: role!.id })
})

afterAll(async () => {
  // Deleting the users cascades their admin_permissions grants.
  if (ctx.ownerId) await User.destroy(ctx.ownerId)
  if (ctx.userId) await User.destroy(ctx.userId)
  await resetSettings()
})

describe('canAdmin guard', () => {
  it('denies a user with no admin grant (403)', async () => {
    const res = await admin('get', '/settings', ctx.userToken)
    expect(res.status).toBe(403)
  })

  it('allows the platform owner (admin role grant)', async () => {
    const res = await admin('get', '/settings', ctx.ownerToken)
    expect(res.status).toBe(200)
  })

  it('denies an unauthenticated request (401)', async () => {
    const res = await request(app).get('/api/v1/admin/settings')
    expect(res.status).toBe(401)
  })
})

describe('global settings', () => {
  it('returns settings merged over defaults', async () => {
    const res = await admin('get', '/settings', ctx.ownerToken)
    expect(res.body.data.platform.name).toBe('Arkyc')
    expect(res.body.data.platform.signups_enabled).toBe(true)
    expect(res.body.data.realtime.transport).toBe('off')
  })

  it('deep-merges and persists a partial update', async () => {
    const upd = await admin('patch', '/settings', ctx.ownerToken).send({
      platform: { name: 'My Platform', signups_enabled: false },
      realtime: { transport: 'soketi' },
    })
    expect(upd.status).toBe(200)
    expect(upd.body.data.platform.name).toBe('My Platform')
    expect(upd.body.data.platform.signups_enabled).toBe(false)
    expect(upd.body.data.realtime.transport).toBe('soketi')

    const again = await admin('get', '/settings', ctx.ownerToken)
    expect(again.body.data.platform.name).toBe('My Platform')
    expect(again.body.data.realtime.transport).toBe('soketi')
  })

  it('rejects an invalid realtime transport (422)', async () => {
    const res = await admin('patch', '/settings', ctx.ownerToken).send({
      realtime: { transport: 'invalid' },
    })
    expect(res.status).toBe(422)
  })

  it('denies updates for a non-admin user (403)', async () => {
    const res = await admin('patch', '/settings', ctx.userToken).send({ platform: { name: 'x' } })
    expect(res.status).toBe(403)
  })
})

describe('admin tenants surface', () => {
  it('lists tenants for the platform owner', async () => {
    const res = await admin('get', '/tenants', ctx.ownerToken)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('denies the tenants list for a non-admin user (403)', async () => {
    const res = await admin('get', '/tenants', ctx.userToken)
    expect(res.status).toBe(403)
  })
})

describe('admin users', () => {
  it('denies a non-admin (403)', async () => {
    const res = await admin('get', '/users', ctx.userToken)
    expect(res.status).toBe(403)
  })

  it('lists platform users for an admin', async () => {
    const res = await admin('get', '/users', ctx.ownerToken)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    const owner = res.body.data.find((u: { id: string }) => u.id === ctx.ownerId)
    expect(owner?.is_admin).toBe(true)
  })
})

describe('admin audit log', () => {
  it('denies a non-admin (403)', async () => {
    const res = await admin('get', '/audit-logs', ctx.userToken)
    expect(res.status).toBe(403)
  })

  it('records and lists platform-admin actions, with the acting user', async () => {
    // The settings update earlier in this run wrote a platform audit entry.
    const res = await admin('get', '/audit-logs', ctx.ownerToken)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)

    const entry = res.body.data.find(
      (e: { action: string }) => e.action === 'platform.settings_updated',
    )
    expect(entry).toBeTruthy()
    expect(entry.actor?.id).toBe(ctx.ownerId)
  })
})

// Run last: this grants then revokes admin on the otherwise-non-admin user.
describe('admin user management', () => {
  it('grants and revokes platform admin for a user', async () => {
    const grant = await admin('post', `/users/${ctx.userId}/admin`, ctx.ownerToken)
    expect(grant.status).toBe(200)

    // The newly-granted user can now reach a canAdmin route.
    const allowed = await admin('get', '/settings', ctx.userToken)
    expect(allowed.status).toBe(200)

    const revoke = await admin('delete', `/users/${ctx.userId}/admin`, ctx.ownerToken)
    expect(revoke.status).toBe(200)

    const denied = await admin('get', '/settings', ctx.userToken)
    expect(denied.status).toBe(403)

    // Both the grant and revoke were recorded in the platform audit log.
    const audit = await admin('get', '/audit-logs?action=platform.admin_granted', ctx.ownerToken)
    const granted = audit.body.data.find((e: { entity_id: string }) => e.entity_id === ctx.userId)
    expect(granted?.actor?.id).toBe(ctx.ownerId)
  })
})
