import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClientToken, generateApiKey } from '@arkyc/auth'
import { syncDefaultPermissions, syncDefaultRoles } from '@arkyc/permissions'

import { ApiKey } from '../src/app/models/ApiKey'
import { Hash } from '@arkstack/common'
import { Project } from '../src/app/models/Project'
import { Role } from '../src/app/models/Role'
import { Tenant } from '../src/app/models/Tenant'
import { TenantMember } from '../src/app/models/TenantMember'
import { User } from '../src/app/models/User'
import { VerificationSession } from '../src/app/models/VerificationSession'
import { app } from '../src/core/bootstrap'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'
import request from 'parasito'

const PASSWORD = 'secret123'

const fx = {
  tenantId: '',
  ownerEmail: '',
  reviewerEmail: '',
  loginEmail: '',
  // Arkstack issues one device-scoped session per user; reuse each user's
  // first-login token (a later login for the same user is not the active one).
  ownerToken: '',
  reviewerToken: '',
  apiKeySecret: '',
  clientToken: '',
  sessionId: '',
}

/** Create an isolated tenant with system roles, members, an API key, and a session. */
beforeAll(async () => {
  const s = Date.now()
  await syncDefaultPermissions(permissionStore)

  const tenant = await Tenant.create({ name: 'Test Co', slug: `test-${s}`, settings: {} })
  fx.tenantId = tenant.id
  await syncDefaultRoles(tenant.id, permissionStore)

  const ownerRole = await Role.where({ tenantId: tenant.id, slug: 'owner' }).first()
  const reviewerRole = await Role.where({ tenantId: tenant.id, slug: 'reviewer' }).first()
  const password = await Hash.make(PASSWORD)

  fx.ownerEmail = `owner-${s}@test.dev`
  fx.reviewerEmail = `reviewer-${s}@test.dev`
  fx.loginEmail = `login-${s}@test.dev`
  const owner = await User.create({ name: 'Owner', email: fx.ownerEmail, password })
  const reviewer = await User.create({ name: 'Reviewer', email: fx.reviewerEmail, password })
  // A user with no prior token, reserved for exercising the login endpoint once.
  await User.create({ name: 'Login', email: fx.loginEmail, password })

  await TenantMember.create({
    tenantId: tenant.id,
    userId: owner.id,
    roleId: ownerRole!.id,
    status: 'active',
    joinedAt: new Date(),
  })
  await TenantMember.create({
    tenantId: tenant.id,
    userId: reviewer.id,
    roleId: reviewerRole!.id,
    status: 'active',
    joinedAt: new Date(),
  })

  const project = await Project.create({
    tenantId: tenant.id,
    name: 'Prod',
    slug: `prod-${s}`,
    environment: 'production',
    settings: {},
    branding: {},
    status: 'active',
  })

  const key = generateApiKey('live')
  fx.apiKeySecret = key.secret
  await ApiKey.create({
    tenantId: tenant.id,
    projectId: project.id,
    name: 'Test key',
    keyPrefix: key.keyPrefix,
    keyHash: key.keyHash,
  })

  const ct = createClientToken(900)
  fx.clientToken = ct.token
  const session = await VerificationSession.create({
    tenantId: tenant.id,
    projectId: project.id,
    status: 'started',
    clientTokenHash: ct.tokenHash,
    expiresAt: ct.expiresAt,
    metadata: {},
  })
  fx.sessionId = session.id

  // First (and only) login per user; reuse these tokens across tests.
  fx.ownerToken = await login(fx.ownerEmail, PASSWORD)
  fx.reviewerToken = await login(fx.reviewerEmail, PASSWORD)
})

afterAll(async () => {
  if (fx.tenantId) await Tenant.destroy(fx.tenantId)
})

async function login (email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password })

  return res.body?.token
}

describe('health', () => {
  it('responds OK', async () => {
    await request(app).get('/api').expect(200).contains('"status":"OK"')
  })
})

describe('dashboard auth (Arkstack built-in)', () => {
  it('registers a new user and returns a token (password never leaks)', async () => {
    const email = `new-${Date.now()}@test.dev`
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'New', email, password: PASSWORD })
    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe(email)
    expect(res.body.token).toBeTruthy()
    expect(JSON.stringify(res.body)).not.toContain('password')
  })

  it('rejects duplicate registration (kanun unique rule)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email: fx.ownerEmail, password: PASSWORD })
    expect(res.status).toBe(422)
  })

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const ok = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: fx.loginEmail, password: PASSWORD })
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBeTruthy()

    const bad = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: fx.loginEmail, password: 'wrong' })
    expect(bad.status).toBe(422)
  })

  it('returns the current user with a token, 401 without', async () => {
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${fx.ownerToken}`)
    expect(me.status).toBe(200)
    expect(me.body.data.email).toBe(fx.ownerEmail)

    await request(app).get('/api/v1/auth/me').expect(401)
  })
})

describe('tenant scope + permissions', () => {
  it('allows a member with the permission (owner has tenants.view)', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/tenants/${fx.tenantId}`)
      .set('Authorization', `Bearer ${fx.ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(fx.tenantId)
  })

  it('denies a member lacking the permission (reviewer has no tenants.view)', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/tenants/${fx.tenantId}`)
      .set('Authorization', `Bearer ${fx.reviewerToken}`)
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('Permission denied')
  })

  it('denies a non-member with 403', async () => {
    const email = `outsider-${Date.now()}@test.dev`
    // Register issues the user's session token; reuse it rather than re-logging in.
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Out', email, password: PASSWORD })
    const res = await request(app)
      .get(`/api/v1/dashboard/tenants/${fx.tenantId}`)
      .set('Authorization', `Bearer ${reg.body.token}`)
    expect(res.status).toBe(403)
  })
})

describe('public API-key surface', () => {
  it('authenticates a valid key and rejects a bad one', async () => {
    const ok = await request(app)
      .get('/api/v1/ping/project')
      .set('Authorization', `Bearer ${fx.apiKeySecret}`)
    expect(ok.status).toBe(200)
    expect(ok.body.data.tenant_id).toBe(fx.tenantId)

    await request(app).get('/api/v1/ping/project').set('Authorization', 'Bearer sk_live_bogus').expect(401)
  })
})

describe('client-token surface', () => {
  it('resolves a session from a valid token and rejects a bad one', async () => {
    const ok = await request(app).get('/api/v1/client/session').set('X-Client-Token', fx.clientToken)
    expect(ok.status).toBe(201)
    expect(ok.body.data.id).toBe(fx.sessionId)

    await request(app).get('/api/v1/client/session').set('X-Client-Token', 'nope').expect(401)
  })
})
