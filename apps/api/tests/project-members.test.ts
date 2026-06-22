import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { Tenant } from '../src/app/models/Tenant'

/** Phase 5 — project membership management through the dashboard API. */
const ctx = { token: '', ownerId: '', tenantId: '', projectId: '', roleId: '' }

const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
  request(app)[method](`/api/v1/dashboard${path}`).set('Authorization', `Bearer ${ctx.token}`)

const members = (suffix = '') =>
  `/tenants/${ctx.tenantId}/projects/${ctx.projectId}/members${suffix}`

beforeAll(async () => {
  const s = Date.now()
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({
      firstname: 'PM Owner',
      lastname: 'Test',
      email: `pm-${s}@test.dev`,
      password: 'secret123',
    })
  ctx.token = reg.body.token
  ctx.ownerId = reg.body.data.id

  const tenant = await authed('post', '/tenants').send({ name: `PM Co ${s}` })
  ctx.tenantId = tenant.body.data.id

  const project = await authed('post', `/tenants/${ctx.tenantId}/projects`).send({
    name: 'PM Prod',
  })
  ctx.projectId = project.body.data.id

  const roles = await authed('get', `/tenants/${ctx.tenantId}/roles`)
  ctx.roleId = roles.body.data.find((r: { slug: string }) => r.slug === 'developer').id
})

afterAll(async () => {
  if (ctx.tenantId) await Tenant.destroy(ctx.tenantId)
})

describe('project members', () => {
  it('starts with no project members', async () => {
    const res = await authed('get', members())
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('adds an existing tenant member to the project', async () => {
    const res = await authed('post', members()).send({ user_id: ctx.ownerId, role_id: ctx.roleId })
    expect(res.status).toBe(201)
    expect(res.body.data.user_id).toBe(ctx.ownerId)
    expect(res.body.data.role_id).toBe(ctx.roleId)
  })

  it('lists members with user + role eager-loaded', async () => {
    const res = await authed('get', members())
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].user.id).toBe(ctx.ownerId)
    expect(res.body.data[0].role.slug).toBe('developer')
  })

  it('rejects a duplicate membership', async () => {
    const res = await authed('post', members()).send({ user_id: ctx.ownerId, role_id: ctx.roleId })
    expect(res.status).toBe(409)
  })

  it('rejects a user who is not a tenant member', async () => {
    const res = await authed('post', members()).send({
      user_id: '00000000-0000-0000-0000-000000000000',
      role_id: ctx.roleId,
    })
    expect(res.status).toBe(422)
  })

  it('changes a member role and removes the member', async () => {
    const list = await authed('get', members())
    const memberId = list.body.data[0].id

    const roles = await authed('get', `/tenants/${ctx.tenantId}/roles`)
    const reviewer = roles.body.data.find((r: { slug: string }) => r.slug === 'reviewer')
    const upd = await authed('patch', members(`/${memberId}`)).send({ role_id: reviewer.id })
    expect(upd.status).toBe(200)
    expect(upd.body.data.role_id).toBe(reviewer.id)

    const del = await authed('delete', members(`/${memberId}`))
    expect(del.status).toBe(200)
    expect((await authed('get', members())).body.data).toEqual([])
  })
})
