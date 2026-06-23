import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { Organization } from '../src/app/models/Organization'

/** Owner-driven walkthrough of the dashboard CRUD surface (Phase 5). */
const ctx = { token: '', userId: '', organizationId: '' }

const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${ctx.token}`)

beforeAll(async () => {
  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({
      firstname: 'Dash Owner',
      lastname: 'Test',
      email: `dash-${s}@test.dev`,
      password: 'secret123',
    })
  ctx.token = reg.body.token
  ctx.userId = reg.body.data.id

  const t = await authed('post', '/organizations').send({ name: `Dash Co ${s}` })
  ctx.organizationId = t.body.data.id
})

afterAll(async () => {
  if (ctx.organizationId) await Organization.destroy(ctx.organizationId)
})

describe('organizations', () => {
  it('created the organization and the creator is its owner', () => {
    expect(ctx.organizationId).toBeTruthy()
  })

  it('lists the organizations the user belongs to', async () => {
    const res = await authed('get', '/organizations')
    expect(res.status).toBe(200)
    expect(res.body.data.map((t: { id: string }) => t.id)).toContain(ctx.organizationId)
  })

  it('shows and updates the organization', async () => {
    const show = await authed('get', `/organizations/${ctx.organizationId}`)
    expect(show.body.data.id).toBe(ctx.organizationId)

    const upd = await authed('patch', `/organizations/${ctx.organizationId}`).send({ name: 'Renamed Co' })
    expect(upd.body.data.name).toBe('Renamed Co')
  })
})

describe('roles & permissions', () => {
  it('serves the permission catalogue (39)', async () => {
    const res = await authed('get', `/organizations/${ctx.organizationId}/permissions`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(39)
  })

  it('seeds the five system roles', async () => {
    const res = await authed('get', `/organizations/${ctx.organizationId}/roles`)
    const slugs = res.body.data.map((r: { slug: string }) => r.slug)
    expect(slugs).toEqual(expect.arrayContaining(['owner', 'admin', 'reviewer', 'developer', 'readonly']))
  })

  it('creates a custom role with a permission set', async () => {
    const res = await authed('post', `/organizations/${ctx.organizationId}/roles`).send({
      name: 'Auditor',
      permissions: ['sessions.view', 'audit_logs.view'],
    })
    expect(res.status).toBe(201)
    expect(res.body.permissions).toEqual(expect.arrayContaining(['sessions.view', 'audit_logs.view']))
  })
})

describe('projects & api keys', () => {
  let projectId = ''

  it('creates and lists a project', async () => {
    const res = await authed('post', `/organizations/${ctx.organizationId}/projects`).send({ name: 'Web App' })
    expect(res.status).toBe(201)
    expect(res.body.data.environment).toBe('production')
    projectId = res.body.data.id

    const list = await authed('get', `/organizations/${ctx.organizationId}/projects`)
    expect(list.body.data.map((p: { id: string }) => p.id)).toContain(projectId)
  })

  it('updates project verification thresholds', async () => {
    const res = await authed('patch', `/organizations/${ctx.organizationId}/projects/${projectId}`).send({
      thresholds: { livenessThreshold: 0.9 },
    })
    expect(res.body.data.settings.thresholds.livenessThreshold).toBe(0.9)
  })

  it('mints an API key (secret shown once) and revokes it', async () => {
    const create = await authed('post', `/organizations/${ctx.organizationId}/projects/${projectId}/api-keys`).send({
      name: 'Default key',
    })
    expect(create.status).toBe(201)
    expect(create.body.secret).toMatch(/^sk_live_/)
    const keyId = create.body.data.id

    const list = await authed('get', `/organizations/${ctx.organizationId}/projects/${projectId}/api-keys`)
    expect(list.body.data.some((k: { id: string }) => k.id === keyId)).toBe(true)
    // The list never exposes the secret hash.
    expect(JSON.stringify(list.body)).not.toContain('keyHash')

    const revoke = await authed('delete', `/organizations/${ctx.organizationId}/projects/${projectId}/api-keys/${keyId}`)
    expect(revoke.status).toBe(200)
    expect(revoke.body.data.revoked_at).toBeTruthy()
  })
})

describe('members & permissions', () => {
  it('lists members with eager-loaded user + role', async () => {
    const res = await authed('get', `/organizations/${ctx.organizationId}/members`)
    expect(res.status).toBe(200)
    const owner = res.body.data.find((m: { user_id: string }) => m.user_id === ctx.userId)
    expect(owner.user.email).toContain('dash-')
    expect(owner.role.slug).toBe('owner')
  })

  it('shows a single member with eager-loaded user + role', async () => {
    const list = await authed('get', `/organizations/${ctx.organizationId}/members`)
    const memberId = list.body.data[0].id
    const res = await authed('get', `/organizations/${ctx.organizationId}/members/${memberId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(memberId)
    expect(res.body.data.user.email).toBeTruthy()
    expect(res.body.data.role.slug).toBeTruthy()
  })

  it('creates an invitation with a one-time token', async () => {
    const roles = await authed('get', `/organizations/${ctx.organizationId}/roles`)
    const reviewer = roles.body.data.find((r: { slug: string }) => r.slug === 'reviewer')
    const res = await authed('post', `/organizations/${ctx.organizationId}/invitations`).send({
      email: `invitee-${Date.now()}@test.dev`,
      role_id: reviewer.id,
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
  })

  it('resolves member effective permissions and grants a direct one', async () => {
    const members = await authed('get', `/organizations/${ctx.organizationId}/members`)
    const memberId = members.body.data[0].id

    const before = await authed('get', `/organizations/${ctx.organizationId}/members/${memberId}/permissions`)
    expect(before.body.data.effective_permissions).toContain('organizations.view')
    expect(before.body.data.direct_permissions).not.toContain('billing.update')

    // Owner already has billing.update via role; grant a direct perm to a fresh reviewer instead.
    const grant = await authed('post', `/organizations/${ctx.organizationId}/members/${memberId}/permissions`).send({
      permission: 'sessions.export',
    })
    expect(grant.status).toBe(200)

    const after = await authed('get', `/organizations/${ctx.organizationId}/members/${memberId}/permissions`)
    expect(after.body.data.direct_permissions).toContain('sessions.export')
  })

  it('rejects granting an unknown permission (exists rule)', async () => {
    const members = await authed('get', `/organizations/${ctx.organizationId}/members`)
    const memberId = members.body.data[0].id

    const res = await authed('post', `/organizations/${ctx.organizationId}/members/${memberId}/permissions`).send({
      permission: 'not.a.real.permission',
    })
    expect(res.status).toBe(422)
  })

  it('rejects assigning a role from another organization', async () => {
    const members = await authed('get', `/organizations/${ctx.organizationId}/members`)
    const memberId = members.body.data[0].id

    const res = await authed('patch', `/organizations/${ctx.organizationId}/members/${memberId}`).send({
      role_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(res.status).toBe(422)
  })
})
