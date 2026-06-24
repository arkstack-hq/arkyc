import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'
import { Role } from '../src/app/models/Role'
import { AdminPermission } from '../src/app/models/AdminPermission'
import { Organization } from '../src/app/models/Organization'
import { User } from '../src/app/models/User'

/** Per-project AI-processing access: owner requests, platform admin grants/revokes. */
const fx = { ownerToken: '', ownerId: '', orgId: '', projectId: '', project2Id: '', adminToken: '', adminId: '' }

const register = (s: number, tag: string) =>
  request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: tag, lastname: 'Test', email: `${tag}-${s}@test.dev`, password: 'secret123' })

const dash = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${token}`)

const admin = (method: 'get' | 'post', path: string, token: string) =>
  request(app)[method](`/api/v1/admin${path}`).set('Authorization', `Bearer ${token}`)

const aiPath = (projectId: string) => `/organizations/${fx.orgId}/projects/${projectId}/ai-access`

beforeAll(async () => {
  const s = Date.now()

  const owner = await register(s, 'aiacc-owner')
  fx.ownerToken = owner.body.token
  fx.ownerId = owner.body.data.id

  const org = await dash('post', '/organizations', fx.ownerToken).send({ name: `AI Co ${s}` })
  fx.orgId = org.body.data.id

  const project = await dash('post', `/organizations/${fx.orgId}/projects`, fx.ownerToken).send({ name: 'AI Prod' })
  fx.projectId = project.body.data.id
  const project2 = await dash('post', `/organizations/${fx.orgId}/projects`, fx.ownerToken).send({ name: 'AI Prod 2' })
  fx.project2Id = project2.body.data.id

  // Platform admin ("sync ownership").
  const adm = await register(s, 'aiacc-admin')
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
  it('reports `none` before any request', async () => {
    const res = await dash('get', aiPath(fx.projectId), fx.ownerToken)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('none')
  })

  it('requests access (pending) and records the requester', async () => {
    const res = await dash('post', `${aiPath(fx.projectId)}/request`, fx.ownerToken).send({ note: 'We need OCR' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('pending')
    expect(res.body.data.requested_by).toBe(fx.ownerId)
  })
})

describe('platform-admin grant/revoke', () => {
  it('lists pending requests for an admin', async () => {
    const res = await admin('get', '/ai-access?status=pending', fx.adminToken)
    expect(res.status).toBe(200)
    expect(res.body.data.some((g: { project_id: string }) => g.project_id === fx.projectId)).toBe(true)
  })

  it('denies the admin surface to a non-admin (403)', async () => {
    const res = await admin('get', '/ai-access', fx.ownerToken)
    expect(res.status).toBe(403)
  })

  it('grants a requested project, visible to the owner', async () => {
    const grant = await admin('post', '/ai-access/grant', fx.adminToken).send({ project_id: fx.projectId })
    expect(grant.status).toBe(200)
    expect(grant.body.data.status).toBe('granted')

    const owner = await dash('get', aiPath(fx.projectId), fx.ownerToken)
    expect(owner.body.data.status).toBe('granted')
  })

  it('grants a project directly, without a prior request', async () => {
    const grant = await admin('post', '/ai-access/grant', fx.adminToken).send({ project_id: fx.project2Id })
    expect(grant.status).toBe(200)
    expect(grant.body.data.status).toBe('granted')
  })

  it('revokes access, reflected back to the owner', async () => {
    const revoke = await admin('post', '/ai-access/revoke', fx.adminToken).send({ project_id: fx.projectId })
    expect(revoke.status).toBe(200)
    expect(revoke.body.data.status).toBe('revoked')

    const owner = await dash('get', aiPath(fx.projectId), fx.ownerToken)
    expect(owner.body.data.status).toBe('revoked')
  })

  it('rejects granting an unknown project (404)', async () => {
    const res = await admin('post', '/ai-access/grant', fx.adminToken).send({
      project_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(res.status).toBe(404)
  })
})

describe('admin organization detail + projects', () => {
  it('shows the org core fields and counts (projects fetched separately)', async () => {
    const res = await admin('get', `/organizations/${fx.orgId}`, fx.adminToken)
    expect(res.status).toBe(200)
    expect(res.body.data.counts.projects).toBeGreaterThanOrEqual(2)
    expect(res.body.data.projects).toBeUndefined()
  })

  it('lists the org projects (paginated) with their AI-access status', async () => {
    const res = await admin('get', `/organizations/${fx.orgId}/projects`, fx.adminToken)
    expect(res.status).toBe(200)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2)

    const projects = res.body.data as Array<{ id: string; ai_access: { status: string } }>
    expect(projects.find((p) => p.id === fx.projectId)?.ai_access.status).toBe('revoked')
    expect(projects.find((p) => p.id === fx.project2Id)?.ai_access.status).toBe('granted')
  })

  it('returns a pending-request count', async () => {
    const res = await admin('get', '/ai-access/count', fx.adminToken)
    expect(res.status).toBe(200)
    expect(typeof res.body.data.count).toBe('number')
  })
})
