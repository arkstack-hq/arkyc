import { ApiKey as ApiKeyAuth, ClientToken } from '@arkyc/auth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApiKey } from '../src/app/models/ApiKey'
import { Hash } from '@arkstack/common'
import { TwoFactor } from '@arkstack/auth'
import { PermissionSync } from '@arkyc/permissions'
import { Project } from '../src/app/models/Project'
import { Role } from '../src/app/models/Role'
import { Organization } from '../src/app/models/Organization'
import { OrganizationMember } from '../src/app/models/OrganizationMember'
import { User } from '../src/app/models/User'
import { VerificationSession } from '../src/app/models/VerificationSession'
import { app } from '../src/core/bootstrap'
import { permissionStore } from '../src/app/services/ArkormPermissionStore'
import request from 'parasito'

const PASSWORD = 'secret123'

const fx = {
  organizationId: '',
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

/** Create an isolated organization with system roles, members, an API key, and a session. */
beforeAll(async () => {
  const s = Date.now()
  await PermissionSync.permissions(permissionStore)

  const organization = await Organization.create({ name: 'Test Co', slug: `test-${s}`, settings: {} })
  fx.organizationId = organization.id
  await PermissionSync.roles(organization.id, permissionStore)

  const ownerRole = await Role.where({ organizationId: organization.id, slug: 'owner' }).first()
  const reviewerRole = await Role.where({ organizationId: organization.id, slug: 'reviewer' }).first()
  const password = await Hash.make(PASSWORD)

  fx.ownerEmail = `owner-${s}@test.dev`
  fx.reviewerEmail = `reviewer-${s}@test.dev`
  fx.loginEmail = `login-${s}@test.dev`
  const owner = await User.create({
    firstName: 'Owner',
    lastName: 'Test',
    email: fx.ownerEmail,
    password,
  })
  const reviewer = await User.create({
    firstName: 'Reviewer',
    lastName: 'Test',
    email: fx.reviewerEmail,
    password,
  })
  // A user with no prior token, reserved for exercising the login endpoint once.
  await User.create({ firstName: 'Login', lastName: 'Test', email: fx.loginEmail, password })

  await OrganizationMember.create({
    organizationId: organization.id,
    userId: owner.id,
    roleId: ownerRole!.id,
    status: 'active',
    joinedAt: new Date(),
  })
  await OrganizationMember.create({
    organizationId: organization.id,
    userId: reviewer.id,
    roleId: reviewerRole!.id,
    status: 'active',
    joinedAt: new Date(),
  })

  const project = await Project.create({
    organizationId: organization.id,
    name: 'Prod',
    slug: `prod-${s}`,
    environment: 'production',
    settings: {},
    branding: {},
    status: 'active',
  })

  const key = ApiKeyAuth.generate('live')
  fx.apiKeySecret = key.secret
  await ApiKey.create({
    organizationId: organization.id,
    projectId: project.id,
    name: 'Test key',
    keyPrefix: key.keyPrefix,
    keyHash: key.keyHash,
  })

  const ct = ClientToken.create(900)
  fx.clientToken = ct.token
  const session = await VerificationSession.create({
    organizationId: organization.id,
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
  if (fx.organizationId) await Organization.destroy(fx.organizationId)
})

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password })

  return res.body?.token
}

describe('health', () => {
  it('responds OK', async () => {
    await request(app).get('/api').expect(200).contains('"status":"online"')
  })
})

describe('dashboard auth (Arkstack built-in)', () => {
  it('registers a new user and returns a token (password never leaks)', async () => {
    const email = `new-${Date.now()}@test.dev`
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ firstname: 'New', lastname: 'Test', email, password: PASSWORD })
    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe(email)
    expect(res.body.token).toBeTruthy()
    expect(JSON.stringify(res.body)).not.toContain('password')
  })

  it('rejects duplicate registration (kanun unique rule)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ firstname: 'Dup', lastname: 'Test', email: fx.ownerEmail, password: PASSWORD })
    expect(res.status).toBe(422)
  })

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const ok = await request(app).post('/api/v1/auth/login').send({ email: fx.loginEmail, password: PASSWORD })
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBeTruthy()

    const bad = await request(app).post('/api/v1/auth/login').send({ email: fx.loginEmail, password: 'wrong' })
    expect(bad.status).toBe(422)
  })

  it('returns the current user with a token, 401 without', async () => {
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${fx.ownerToken}`)
    expect(me.status).toBe(200)
    expect(me.body.data.email).toBe(fx.ownerEmail)

    await request(app).get('/api/v1/auth/me').expect(401)
  })
})

describe('organization scope + permissions', () => {
  it('allows a member with the permission (owner has organizations.view)', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/organizations/${fx.organizationId}`)
      .set('Authorization', `Bearer ${fx.ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(fx.organizationId)
  })

  it('denies a member lacking the permission (reviewer has no organizations.view)', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/organizations/${fx.organizationId}`)
      .set('Authorization', `Bearer ${fx.reviewerToken}`)
    expect(res.status).toBe(403)
    expect(res.body.message).toContain('Permission denied')
  })

  it('denies a non-member with 403', async () => {
    const email = `outsider-${Date.now()}@test.dev`
    // Register issues the user's session token; reuse it rather than re-logging in.
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ firstname: 'Out', lastname: 'Test', email, password: PASSWORD })
    const res = await request(app)
      .get(`/api/v1/dashboard/organizations/${fx.organizationId}`)
      .set('Authorization', `Bearer ${reg.body.token}`)
    expect(res.status).toBe(403)
  })
})

describe('public API-key surface', () => {
  it('authenticates a valid key and rejects a bad one', async () => {
    const ok = await request(app).get('/api/v1/ping/project').set('Authorization', `Bearer ${fx.apiKeySecret}`)
    expect(ok.status).toBe(200)
    expect(ok.body.data.organization_id).toBe(fx.organizationId)

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

describe('two-factor authentication', () => {
  // Fresh accounts so enabling 2FA never interferes with the shared fixtures.
  const totp = { email: '', token: '', secret: '', recoveryCodes: [] as string[] }
  const mail = { email: '', token: '' }

  /** Register a user via the API and return its issued session token. */
  async function register(email: string): Promise<string> {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ firstname: 'Two', lastname: 'Factor', email, password: PASSWORD })

    return res.body.token
  }

  /** Enroll and enable an authenticator factor, returning its secret + recovery codes. */
  async function enrollAuthenticator(email: string, token: string) {
    const setup = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'authenticator' })
    const user = await User.where({ email }).firstOrFail()
    const code = TwoFactor.getTotp(user, setup.body.two_factor.secret).generate()
    const confirm = await request(app)
      .post('/api/v1/auth/2fa/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ method: 'authenticator', code })

    return {
      secret: setup.body.two_factor.secret as string,
      recoveryCodes: confirm.body.two_factor.recovery_codes as string[],
    }
  }

  beforeAll(async () => {
    const s = Date.now()
    totp.email = `totp-${s}@test.dev`
    mail.email = `mfa-mail-${s}@test.dev`
    totp.token = await register(totp.email)
    mail.token = await register(mail.email)
  })

  it('reports 2FA disabled for a fresh account', async () => {
    const res = await request(app).get('/api/v1/auth/2fa').set('Authorization', `Bearer ${totp.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.enabled).toBe(false)
    expect(res.body.data.method).toBeNull()
  })

  it('enrolls and enables an authenticator (TOTP) factor with recovery codes', async () => {
    const setup = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${totp.token}`)
      .send({ method: 'authenticator' })
    expect(setup.status).toBe(201)
    expect(setup.body.two_factor.secret).toBeTruthy()
    expect(setup.body.two_factor.otpauth_url).toContain('otpauth://')
    totp.secret = setup.body.two_factor.secret

    const user = await User.where({ email: totp.email }).firstOrFail()
    const code = TwoFactor.getTotp(user, totp.secret).generate()

    const confirm = await request(app)
      .post('/api/v1/auth/2fa/confirm')
      .set('Authorization', `Bearer ${totp.token}`)
      .send({ method: 'authenticator', code })
    expect(confirm.status).toBe(201)
    expect(confirm.body.two_factor.recovery_codes.length).toBeGreaterThan(0)
    totp.recoveryCodes = confirm.body.two_factor.recovery_codes

    const status = await request(app).get('/api/v1/auth/2fa').set('Authorization', `Bearer ${totp.token}`)
    expect(status.body.data.enabled).toBe(true)
    expect(status.body.data.method).toBe('authenticator')
  })

  it('challenges login for a TOTP user and issues a token only after a valid code', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: totp.email, password: PASSWORD })
    expect(login.status).toBe(200)
    expect(login.body.token).toBeFalsy()
    expect(login.body.two_factor.required).toBe(true)
    expect(login.body.two_factor.method).toBe('authenticator')
    const ticket = login.body.two_factor.ticket
    expect(ticket).toBeTruthy()

    const bad = await request(app).post('/api/v1/auth/login/2fa').send({ ticket, code: '000000' })
    expect(bad.status).toBe(422)

    const user = await User.where({ email: totp.email }).firstOrFail()
    const code = TwoFactor.getTotp(user, totp.secret).generate()
    const ok = await request(app).post('/api/v1/auth/login/2fa').send({ ticket, code })
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBeTruthy()
  })

  it('accepts a one-time recovery code and refuses to reuse it', async () => {
    // A dedicated user: completing a login twice for one account collides on the
    // single device session, so the reuse attempt below is rejected before a token issues.
    const email = `recovery-${Date.now()}@test.dev`
    const token = await register(email)
    const { recoveryCodes } = await enrollAuthenticator(email, token)
    const recovery = recoveryCodes[0]

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD })
    const ok = await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ ticket: login.body.two_factor.ticket, code: recovery })
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBeTruthy()

    const login2 = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD })
    const reuse = await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ ticket: login2.body.two_factor.ticket, code: recovery })
    expect(reuse.status).toBe(422)
  })

  it('enrolls, challenges, resends, and completes an email factor', async () => {
    const setup = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${mail.token}`)
      .send({ method: 'email' })
    expect(setup.status).toBe(201)
    expect(setup.body.two_factor.method).toBe('email')

    const setupCode = Hash.otp(6, `${mail.email}:2fa:setup`, 600).generate()
    const confirm = await request(app)
      .post('/api/v1/auth/2fa/confirm')
      .set('Authorization', `Bearer ${mail.token}`)
      .send({ method: 'email', code: setupCode })
    expect(confirm.status).toBe(201)

    const login = await request(app).post('/api/v1/auth/login').send({ email: mail.email, password: PASSWORD })
    expect(login.body.two_factor.method).toBe('email')
    const ticket = login.body.two_factor.ticket

    const resend = await request(app).post('/api/v1/auth/login/2fa/resend').send({ ticket })
    expect(resend.status).toBe(200)

    const loginCode = Hash.otp(6, `${mail.email}:2fa:login`, 600).generate()
    const ok = await request(app).post('/api/v1/auth/login/2fa').send({ ticket, code: loginCode })
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBeTruthy()
    // Re-capture the active session token; the completed login may rotate it.
    mail.token = ok.body.token
  })

  it('rejects a stale or invalid challenge ticket', async () => {
    const res = await request(app).post('/api/v1/auth/login/2fa').send({ ticket: 'not-a-real-ticket', code: '123456' })
    expect(res.status).toBe(422)
  })

  it('disables 2FA only when the password is re-confirmed', async () => {
    const wrong = await request(app)
      .delete('/api/v1/auth/2fa')
      .set('Authorization', `Bearer ${mail.token}`)
      .send({ password: 'wrong-password' })
    expect(wrong.status).toBe(422)

    const ok = await request(app)
      .delete('/api/v1/auth/2fa')
      .set('Authorization', `Bearer ${mail.token}`)
      .send({ password: PASSWORD })
    expect(ok.status).toBe(200)

    const status = await request(app).get('/api/v1/auth/2fa').set('Authorization', `Bearer ${mail.token}`)
    expect(status.body.data.enabled).toBe(false)
  })
})

describe('organization me (effective permissions)', () => {
  it('returns the full effective permission set for an owner', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/organizations/${fx.organizationId}/me`)
      .set('Authorization', `Bearer ${fx.ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.effective_permissions).toContain('organizations.view')
  })

  it('reflects a narrower set for a reviewer (no organizations.view)', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/organizations/${fx.organizationId}/me`)
      .set('Authorization', `Bearer ${fx.reviewerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.effective_permissions).toContain('reviews.view')
    expect(res.body.data.effective_permissions).not.toContain('organizations.view')
  })
})
