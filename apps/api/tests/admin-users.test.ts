import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'
import { Role } from '../src/app/models/Role'
import { AdminPermission } from '../src/app/models/AdminPermission'
import { Organization } from '../src/app/models/Organization'
import { User } from '../src/app/models/User'

/** Platform-admin user management: account status (restrict/suspend) + password reset. */
const fx = { adminToken: '', adminId: '', targetToken: '', targetId: '', orgId: '' }

const register = (s: number, tag: string, password = 'secret123') =>
  request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: tag, lastname: 'Test', email: `${tag}-${s}@test.dev`, password })

const login = (email: string, password: string) => request(app).post('/api/v1/auth/login').send({ email, password })

const admin = (method: 'get' | 'post' | 'delete', path: string) =>
  request(app)[method](`/api/v1/admin${path}`).set('Authorization', `Bearer ${fx.adminToken}`)

const email = (s: number, tag: string) => `${tag}-${s}@test.dev`

let stamp = 0

beforeAll(async () => {
  stamp = Date.now()

  const adm = await register(stamp, 'au-admin')
  fx.adminToken = adm.body.token
  fx.adminId = adm.body.data.id
  await PermissionSync.adminPermissions(permissionStore)
  await PermissionSync.adminRoles(permissionStore)
  const role = await Role.where({ slug: AdminRoles.bySlug('platform-owner').slug, admin: true }).first()
  await AdminPermission.create({ userId: fx.adminId, roleId: role!.id })

  const target = await register(stamp, 'au-target')
  fx.targetToken = target.body.token
  fx.targetId = target.body.data.id
  // Target owns an org so we can exercise the restricted (read-only) gate.
  const org = await request(app)
    .post('/api/v1/dashboard/organizations')
    .set('Authorization', `Bearer ${fx.targetToken}`)
    .send({ name: `AU Co ${stamp}` })
  fx.orgId = org.body.data.id
})

afterAll(async () => {
  if (fx.orgId) await Organization.destroy(fx.orgId)
  if (fx.adminId) await User.destroy(fx.adminId)
  if (fx.targetId) await User.destroy(fx.targetId)
})

describe('account status', () => {
  it('rejects an unknown status (422)', async () => {
    const res = await admin('post', `/users/${fx.targetId}/status`).send({ status: 'banished' })
    expect(res.status).toBe(422)
  })

  it("forbids changing one's own status (422)", async () => {
    const res = await admin('post', `/users/${fx.adminId}/status`).send({ status: 'suspended' })
    expect(res.status).toBe(422)
  })

  it('restricts a user to read-only — views pass, mutations are denied', async () => {
    const set = await admin('post', `/users/${fx.targetId}/status`).send({ status: 'restricted' })
    expect(set.status).toBe(200)
    expect(set.body.data.status).toBe('restricted')

    const auth = `Bearer ${fx.targetToken}`
    const view = await request(app)
      .get(`/api/v1/dashboard/organizations/${fx.orgId}/projects`)
      .set('Authorization', auth)
    expect(view.status).toBe(200)

    const mutate = await request(app)
      .post(`/api/v1/dashboard/organizations/${fx.orgId}/projects`)
      .set('Authorization', auth)
      .send({ name: 'Blocked' })
    expect(mutate.status).toBe(403)
  })

  it('suspends a user — login is blocked', async () => {
    const set = await admin('post', `/users/${fx.targetId}/status`).send({ status: 'suspended' })
    expect(set.status).toBe(200)

    const res = await login(email(stamp, 'au-target'), 'secret123')
    expect(res.status).toBe(403)
  })

  it('reactivates and resets the password — the new password logs in', async () => {
    await admin('post', `/users/${fx.targetId}/status`).send({ status: 'active' })

    const reset = await admin('post', `/users/${fx.targetId}/password`).send({ password: 'brandnew123' })
    expect(reset.status).toBe(200)

    const res = await login(email(stamp, 'au-target'), 'brandnew123')
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
  })

  it('exposes status on the admin user detail', async () => {
    const res = await admin('get', `/users/${fx.targetId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('active')
    expect(res.body.data.email).toContain('au-target')
  })
})
