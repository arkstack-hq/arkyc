import { describe, expect, it } from 'vitest'
import request from 'parasito'
import { app } from '../src/core/bootstrap'
import { Organization } from '../src/app/models/Organization'
import { Project } from '../src/app/models/Project'
import { VerificationSession } from '../src/app/models/VerificationSession'

async function owner() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const registered = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'Delete', lastname: 'Owner', email: `del-${stamp}@test.dev`, password: 'secret123' })
  const token = registered.body.token as string
  const as = (method: 'get' | 'post' | 'delete', path: string) =>
    request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`)

  const organization = (await as('post', '/dashboard/organizations').send({ name: `Delete Co ${stamp}` })).body.data
  const org = (path = '') => `/dashboard/organizations/${organization.id}${path}`
  const project = (await as('post', org('/projects')).send({ name: 'Doomed' })).body.data
  const secret = (await as('post', org(`/projects/${project.id}/api-keys`)).send({ name: 'Key' })).body.secret
  const session = (await request(app).post('/api/v1/sessions').set('Authorization', `Bearer ${secret}`).send({})).body
    .data

  return { as, org, organization, project, session }
}

describe('deleting a project', () => {
  it('needs the exact project name, then removes the project and its sessions', async () => {
    const { as, org, project, session } = await owner()

    expect((await as('delete', org(`/projects/${project.id}`)).send({ name: 'doomed' })).status).toBe(422)
    expect(await Project.where({ id: project.id }).first()).toBeTruthy()

    expect((await as('delete', org(`/projects/${project.id}`)).send({ name: 'Doomed' })).status).toBe(200)
    expect(await Project.where({ id: project.id }).first()).toBeNull()
    expect(await VerificationSession.where({ id: session.id }).first()).toBeNull()
  })
})

describe('deleting an organization', () => {
  it('needs the exact organization name, then removes it with its projects', async () => {
    const { as, org, organization, project } = await owner()

    expect((await as('delete', org()).send({ name: 'wrong' })).status).toBe(422)

    expect((await as('delete', org()).send({ name: organization.name })).status).toBe(200)
    expect(await Organization.where({ id: organization.id }).first()).toBeNull()
    expect(await Project.where({ id: project.id }).first()).toBeNull()
  })
})
