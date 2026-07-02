import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'
import { Role } from '../src/app/models/Role'
import { AdminPermission } from '../src/app/models/AdminPermission'
import { Organization } from '../src/app/models/Organization'
import { User } from '../src/app/models/User'

/** Per-project extended access: owner requests capabilities, platform admin grants/revokes each. */
const fx = { ownerToken: '', ownerId: '', orgId: '', projectId: '', project2Id: '', adminToken: '', adminId: '' }

const register = (s: number, tag: string) =>
  request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: tag, lastname: 'Test', email: `${tag}-${s}@test.dev`, password: 'secret123' })

const dash = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${token}`)

const admin = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/admin${path}`).set('Authorization', `Bearer ${token}`)

const path = (projectId: string) => `/organizations/${fx.orgId}/projects/${projectId}/extended-access`

type Grant = { capability: string; status: string; requested_by?: string; details?: unknown }
const cap = (body: { data: Grant[] }, capability: string) => body.data.find((g) => g.capability === capability)

beforeAll(async () => {
  const s = Date.now()

  const owner = await register(s, 'extacc-owner')
  fx.ownerToken = owner.body.token
  fx.ownerId = owner.body.data.id

  const org = await dash('post', '/organizations', fx.ownerToken).send({ name: `Ext Co ${s}` })
  fx.orgId = org.body.data.id

  const project = await dash('post', `/organizations/${fx.orgId}/projects`, fx.ownerToken).send({ name: 'Ext Prod' })
  fx.projectId = project.body.data.id
  const project2 = await dash('post', `/organizations/${fx.orgId}/projects`, fx.ownerToken).send({ name: 'Ext Prod 2' })
  fx.project2Id = project2.body.data.id

  const adm = await register(s, 'extacc-admin')
  fx.adminToken = adm.body.token
  fx.adminId = adm.body.data.id
  await PermissionSync.adminPermissions(permissionStore)
  await PermissionSync.adminRoles(permissionStore)
  const role = await Role.where({ slug: AdminRoles.bySlug('platform-owner').slug, admin: true }).first()
  await AdminPermission.create({ userId: fx.adminId, roleId: role!.id })
})

afterAll(async () => {
  if (fx.orgId) await Organization.destroy(fx.orgId)
  if (fx.adminId) await User.destroy(fx.adminId)
  if (fx.ownerId) await User.destroy(fx.ownerId)
})

describe('owner request flow', () => {
  it('reports every capability as `none` before any request', async () => {
    const res = await dash('get', path(fx.projectId), fx.ownerToken)
    expect(res.status).toBe(200)
    expect(cap(res.body, 'ai')?.status).toBe('none')
    expect(cap(res.body, 'pii')?.status).toBe('none')
  })

  it('requests the ai capability (pending) and records the requester', async () => {
    const res = await dash('post', `${path(fx.projectId)}/request`, fx.ownerToken).send({ capabilities: ['ai'] })
    expect(res.status).toBe(200)
    expect(cap(res.body, 'ai')?.status).toBe('pending')
    expect(cap(res.body, 'ai')?.requested_by).toBe(fx.ownerId)
    expect(cap(res.body, 'pii')?.status).toBe('none')
  })

  it('rejects a pii request that omits its details (422)', async () => {
    const res = await dash('post', `${path(fx.projectId)}/request`, fx.ownerToken).send({ capabilities: ['pii'] })
    expect(res.status).toBe(422)
  })

  it('requests pii with categories, timing, and justification', async () => {
    const res = await dash('post', `${path(fx.projectId)}/request`, fx.ownerToken).send({
      capabilities: ['pii'],
      pii: { categories: ['identity'], timing: 'after', justification: 'Encrypted at rest, 30-day retention.' },
    })
    expect(res.status).toBe(200)
    const pii = cap(res.body, 'pii')
    expect(pii?.status).toBe('pending')
    expect(pii?.details).toMatchObject({ categories: ['identity'], timing: 'after' })
  })
})

describe('platform-admin review', () => {
  it('denies the admin surface to a non-admin (403)', async () => {
    const res = await admin('get', '/extended-access', fx.ownerToken)
    expect(res.status).toBe(403)
  })

  it('lists a project all its capabilities on the review endpoint', async () => {
    const res = await admin('get', `/extended-access/projects/${fx.projectId}`, fx.adminToken)
    expect(res.status).toBe(200)
    expect(res.body.project.id).toBe(fx.projectId)
    expect(res.body.data.map((g: Grant) => g.capability).sort()).toEqual(['ai', 'pii'])
  })

  it('grants one capability and leaves the other pending (partial approval)', async () => {
    const grant = await admin('post', '/extended-access/grant', fx.adminToken).send({
      project_id: fx.projectId,
      capability: 'ai',
    })
    expect(grant.status).toBe(200)
    expect(grant.body.data.status).toBe('granted')

    const owner = await dash('get', path(fx.projectId), fx.ownerToken)
    expect(cap(owner.body, 'ai')?.status).toBe('granted')
    expect(cap(owner.body, 'pii')?.status).toBe('pending')
  })

  it('grants a capability directly, without a prior request', async () => {
    const grant = await admin('post', '/extended-access/grant', fx.adminToken).send({
      project_id: fx.project2Id,
      capability: 'ai',
    })
    expect(grant.status).toBe(200)
    expect(grant.body.data.status).toBe('granted')
  })

  it('revokes a capability, reflected back to the owner', async () => {
    const revoke = await admin('post', '/extended-access/revoke', fx.adminToken).send({
      project_id: fx.projectId,
      capability: 'ai',
    })
    expect(revoke.status).toBe(200)
    expect(revoke.body.data.status).toBe('revoked')

    const owner = await dash('get', path(fx.projectId), fx.ownerToken)
    expect(cap(owner.body, 'ai')?.status).toBe('revoked')
  })

  it('rejects granting an unknown project (404)', async () => {
    const res = await admin('post', '/extended-access/grant', fx.adminToken).send({
      project_id: '00000000-0000-0000-0000-000000000000',
      capability: 'ai',
    })
    expect(res.status).toBe(404)
  })

  it('rejects an unknown capability (422)', async () => {
    const res = await admin('post', '/extended-access/grant', fx.adminToken).send({
      project_id: fx.projectId,
      capability: 'nope',
    })
    expect(res.status).toBe(422)
  })

  it('returns a pending-request count', async () => {
    const res = await admin('get', '/extended-access/count', fx.adminToken)
    expect(res.status).toBe(200)
    expect(typeof res.body.data.count).toBe('number')
  })
})

describe('admin organization projects', () => {
  it('lists org projects with per-capability extended-access status', async () => {
    const res = await admin('get', `/organizations/${fx.orgId}/projects`, fx.adminToken)
    expect(res.status).toBe(200)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2)

    const projects = res.body.data as Array<{ id: string; extended_access: { ai: { status: string } } }>
    expect(projects.find((p) => p.id === fx.projectId)?.extended_access.ai.status).toBe('revoked')
    expect(projects.find((p) => p.id === fx.project2Id)?.extended_access.ai.status).toBe('granted')
  })
})
