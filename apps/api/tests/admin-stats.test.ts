import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'
import { Role } from '../src/app/models/Role'
import { AdminPermission } from '../src/app/models/AdminPermission'
import { User } from '../src/app/models/User'

/** Platform-admin overview statistics (totals, breakdowns, daily trend). */
const fx = { adminToken: '', adminId: '', userToken: '', userId: '' }

const register = (s: number, tag: string, password = 'secret123') =>
  request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: tag, lastname: 'Test', email: `${tag}-${s}@test.dev`, password })

const stats = (token: string) => request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${token}`)

beforeAll(async () => {
  const stamp = Date.now()

  const adm = await register(stamp, 'as-admin')
  fx.adminToken = adm.body.token
  fx.adminId = adm.body.data.id
  await PermissionSync.adminPermissions(permissionStore)
  await PermissionSync.adminRoles(permissionStore)
  const role = await Role.where({ slug: AdminRoles.bySlug('platform-owner').slug, admin: true }).first()
  await AdminPermission.create({ userId: fx.adminId, roleId: role!.id })

  const usr = await register(stamp, 'as-user')
  fx.userToken = usr.body.token
  fx.userId = usr.body.data.id
})

afterAll(async () => {
  if (fx.adminId) await User.destroy(fx.adminId)
  if (fx.userId) await User.destroy(fx.userId)
})

describe('admin platform stats', () => {
  it('forbids a non-admin', async () => {
    const res = await stats(fx.userToken)
    expect(res.status).toBe(403)
  })

  it('returns comprehensive platform statistics', async () => {
    const res = await stats(fx.adminToken)
    expect(res.status).toBe(200)

    const data = res.body.data
    // Headline totals are all present and numeric.
    for (const key of ['organizations', 'users', 'projects', 'sessions', 'api_keys', 'webhooks', 'reviews', 'admins']) {
      expect(typeof data.totals[key]).toBe('number')
    }
    expect(data.totals.users).toBeGreaterThanOrEqual(2)
    expect(data.totals.admins).toBeGreaterThanOrEqual(1)

    // Account-standing splits partition the user total.
    expect(data.users.active + data.users.restricted + data.users.suspended).toBe(data.totals.users)

    // The session breakdown carries every status, zero-filled.
    for (const status of ['pending', 'processing', 'requires_review', 'approved', 'rejected', 'expired', 'cancelled']) {
      expect(typeof data.sessions.by_status[status]).toBe('number')
    }
    expect(data.sessions.approval_rate).toBeGreaterThanOrEqual(0)
    expect(data.sessions.approval_rate).toBeLessThanOrEqual(1)

    // Extended-access buckets + a continuous 30-day daily trend.
    expect(data.extended_access).toEqual(
      expect.objectContaining({
        pending: expect.any(Number),
        granted: expect.any(Number),
        revoked: expect.any(Number),
      }),
    )
    expect(data.trend).toHaveLength(30)
    expect(data.trend[0]).toEqual(expect.objectContaining({ date: expect.any(String), count: expect.any(Number) }))
  })
})
