import { describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { ApiKey } from '../src/app/models/ApiKey'

async function owner() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const registered = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'Clone', lastname: 'Owner', email: `clone-${stamp}@test.dev`, password: 'secret123' })
  const token = registered.body.token as string
  const as = (method: 'get' | 'post' | 'patch', path: string) =>
    request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`)

  const organization = (await as('post', '/dashboard/organizations').send({ name: `Clone Co ${stamp}` })).body.data
  const org = (path = '') => `/dashboard/organizations/${organization.id}${path}`

  return { as, org }
}

describe('cloning a project', () => {
  it('copies settings and branding into a new project in the chosen environment', async () => {
    const { as, org } = await owner()
    const source = (await as('post', org('/projects')).send({ name: 'Original' })).body.data

    await as('patch', org(`/projects/${source.id}`)).send({
      settings: { max_retries: 7, allowed_origins: ['https://app.test'] },
      branding: { primary_color: '#123456' },
    })
    await as('post', org(`/projects/${source.id}/api-keys`)).send({ name: 'Key' })

    const res = await as('post', org(`/projects/${source.id}/clone`)).send({
      name: 'Original copy',
      environment: 'staging',
    })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      name: 'Original copy',
      environment: 'staging',
      settings: { max_retries: 7, allowed_origins: ['https://app.test'] },
      branding: { primary_color: '#123456' },
    })
    expect(res.body.data.id).not.toBe(source.id)
    expect(await ApiKey.where({ projectId: res.body.data.id }).first()).toBeNull()
  })

  it('refuses production for an unverified organization and a duplicate name', async () => {
    const { as, org } = await owner()
    const source = (await as('post', org('/projects')).send({ name: 'Source' })).body.data
    const clone = (body: Record<string, string>) => as('post', org(`/projects/${source.id}/clone`)).send(body)

    expect((await clone({ name: 'Live', environment: 'production' })).body.errors).toHaveProperty('environment')
    expect((await clone({ name: 'Source', environment: 'development' })).body.errors).toHaveProperty('name')
  })
})
