import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { AdminRoles, PermissionSync } from '@arkyc/permissions'
import { app } from '../src/core/bootstrap'
import { AdminPermission } from '../src/app/models/AdminPermission'
import { Organization } from '../src/app/models/Organization'
import { Role } from '../src/app/models/Role'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'

type Caller = (method: 'get' | 'post' | 'patch', path: string) => ReturnType<typeof request>['get']

const fx = { owner: null as unknown as Caller, admin: null as unknown as Caller, organizationId: '' }

async function account(tag: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'Biz', lastname: tag, email: `bv-${tag}-${stamp}@test.dev`, password: 'secret123' })
  const call = ((method: 'get' | 'post' | 'patch', path: string) =>
    request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${res.body.token}`)) as unknown as Caller

  return { id: res.body.data.id as string, call }
}

const org = (path = '') => `/dashboard/organizations/${fx.organizationId}${path}`

function submission(overrides: Record<string, string> = {}) {
  const form = new FormData()
  const fields: Record<string, string> = {
    legal_name: 'Biz Test Limited',
    country: 'NG',
    registration_number: 'RC123456',
    registered_address: '1 Test Street, Lagos',
    website: 'https://biz.example.com',
    dpo_name: 'Data Officer',
    dpo_email: 'dpo@biz.example.com',
    privacy_policy_url: 'https://biz.example.com/privacy',
    ...overrides,
  }
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('incorporation_document', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'cac.pdf')

  return form
}

/** Open a session on a project, returning the HTTP status. */
async function openSession(projectId: string): Promise<number> {
  const secret = (await (fx.owner('post', org(`/projects/${projectId}/api-keys`)) as any).send({ name: 'Key' })).body
    .secret
  const res = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${secret}`).send({})

  return res.status
}

beforeAll(async () => {
  const owner = await account('owner')
  fx.owner = owner.call
  fx.organizationId = (
    await (fx.owner('post', '/dashboard/organizations') as any).send({ name: `Biz ${Date.now()}` })
  ).body.data.id

  const admin = await account('admin')
  fx.admin = admin.call
  await PermissionSync.adminPermissions(permissionStore)
  await PermissionSync.adminRoles(permissionStore)
  const role = await Role.where({ slug: AdminRoles.bySlug('platform-owner').slug, admin: true }).first()
  await AdminPermission.create({ userId: admin.id, roleId: role!.id })
})

afterAll(async () => {
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

describe('before verification', () => {
  it('starts projects in development and refuses production', async () => {
    const dev = await (fx.owner('post', org('/projects')) as any).send({ name: 'Dev App' })
    expect(dev.status).toBe(201)
    expect(dev.body.data.environment).toBe('development')
    expect(await openSession(dev.body.data.id)).toBe(201)

    const prod = await (fx.owner('post', org('/projects')) as any).send({ name: 'Prod App', environment: 'production' })
    expect(prod.status).toBe(422)
  })

  it('refuses live sessions on an existing production project', async () => {
    const organization = await Organization.where({ id: fx.organizationId }).firstOrFail()
    organization.verificationStatus = 'verified'
    await organization.save()
    const prod = await (fx.owner('post', org('/projects')) as any).send({ name: 'Live App', environment: 'production' })
    organization.verificationStatus = 'unverified'
    await organization.save()

    const secret = (
      await (fx.owner('post', org(`/projects/${prod.body.data.id}/api-keys`)) as any).send({ name: 'Key' })
    ).body.secret
    const res = await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${secret}`).send({})
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('organization_unverified')
  })
})

describe('submitting and reviewing', () => {
  it('rejects an incomplete submission', async () => {
    const res = await (fx.owner('post', org('/verification')) as any).send(submission({ dpo_email: 'not-an-email' }))
    expect(res.status).toBe(422)
  })

  it('reviews a submission and lifts the production gate once approved', async () => {
    const submitted = await (fx.owner('post', org('/verification')) as any).send(submission())
    expect(submitted.status).toBe(201)
    expect(submitted.body.data.documents).toEqual(['incorporation'])

    const status = await (fx.owner('get', org('/verification')) as any)
    expect(status.body.data.status).toBe('pending')
    expect((await (fx.owner('post', org('/verification')) as any).send(submission())).status).toBe(409)

    const count = await (fx.admin('get', '/admin/business-verifications/count') as any)
    expect(count.body.data.count).toBeGreaterThanOrEqual(1)

    const id = submitted.body.data.id
    const doc = await (fx.admin('get', `/admin/business-verifications/${id}/documents/incorporation`) as any)
    expect(doc.status).toBe(200)

    expect((await (fx.admin('patch', `/admin/business-verifications/${id}/reject`) as any).send({})).status).toBe(422)
    expect(
      (await (fx.admin('patch', `/admin/business-verifications/${id}/approve`) as any).send({ note: 'Looks good' }))
        .status,
    ).toBe(201)

    const after = await (fx.owner('get', org('/verification')) as any)
    expect(after.body.data.status).toBe('verified')
    expect(after.body.data.can_go_live).toBe(true)

    const prod = await (fx.owner('post', org('/projects')) as any).send({ name: 'Now Live', environment: 'production' })
    expect(prod.status).toBe(201)
    expect(await openSession(prod.body.data.id)).toBe(201)
  })

  it('keeps the organization out of the admin queue for other users', async () => {
    expect((await (fx.owner('get', '/admin/business-verifications') as any)).status).toBe(403)
  })
})

describe('admin organization and project views', () => {
  it('reports verification, counts and session outcomes', async () => {
    const detail = await (fx.admin('get', `/admin/organizations/${fx.organizationId}`) as any)
    expect(detail.status).toBe(200)
    expect(detail.body.data.verification_status).toBe('verified')
    expect(detail.body.data.counts.production_projects).toBeGreaterThanOrEqual(1)
    expect(detail.body.data.stats.trend).toHaveLength(30)
    expect(detail.body.data.stats.total).toBeGreaterThanOrEqual(1)

    const projects = await (fx.admin('get', `/admin/organizations/${fx.organizationId}/projects`) as any)
    const projectId = projects.body.data[0].id
    const project = await (fx.admin('get', `/admin/organizations/${fx.organizationId}/projects/${projectId}`) as any)
    expect(project.status).toBe(200)
    expect(project.body.data.organization.id).toBe(fx.organizationId)
    expect(project.body.data.thresholds.faceMatchThreshold).toBeTypeOf('number')
    expect(project.body.data.extended_access.pii.status).toBe('none')
  })
})
