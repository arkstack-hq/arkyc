import { describe, expect, it } from 'vitest'
import request from 'parasito'
import { Hash } from '@arkstack/common'
import { app } from '../src/core/bootstrap'
import { User } from '../src/app/models/User'
import { PasswordReset } from '../src/app/models/PasswordReset'

async function registerUser(email: string, password = 'secret123'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ firstname: 'Acct', lastname: 'Test', email, password })

  return res.body.token
}

describe('email verification', () => {
  it('sends a code and marks the email verified', async () => {
    const email = `verify-${Date.now()}@test.dev`
    const token = await registerUser(email)

    const send = await request(app)
      .post('/api/v1/auth/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ object: 'email' })
    expect(send.status).toBe(201)

    // The code is a stateless time-based OTP keyed by the email — regenerate it.
    const code = Hash.otp(6, email, 60 * 15).generate()
    const verify = await request(app)
      .put('/api/v1/auth/verify/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code })
    expect(verify.status).toBe(202)

    const user = await User.where({ email }).firstOrFail()
    expect(user.emailVerifiedAt).toBeTruthy()
  })

  it('rejects an invalid verification code', async () => {
    const email = `verify-bad-${Date.now()}@test.dev`
    const token = await registerUser(email)
    const res = await request(app)
      .put('/api/v1/auth/verify/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' })
    expect(res.status).toBe(422)
  })
})

describe('password reset', () => {
  it('requests a code, verifies it, and sets a new password', async () => {
    // Create the user directly (no prior session token) so the post-reset login
    // is the user's first device session.
    const email = `reset-${Date.now()}@test.dev`
    await User.create({
      firstName: 'Acct',
      lastName: 'Test',
      email,
      password: await Hash.make('oldpass123'),
    })

    const forgot = await request(app).post('/api/v1/auth/forgot').send({ email })
    expect(forgot.status).toBe(201)

    // The reset code is stored on the PasswordReset row.
    const pr = await PasswordReset.where({ email }).firstOrFail()
    const code = pr.token

    const check = await request(app).get(`/api/v1/auth/forgot/${code}`)
    expect(check.status).toBe(202)

    const reset = await request(app).put(`/api/v1/auth/forgot/${code}`).send({ password: 'newpass123' })
    expect(reset.status).toBe(202)

    // Old password no longer works; new one does.
    const oldLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'oldpass123' })
    expect(oldLogin.status).toBe(422)
    const newLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'newpass123' })
    expect(newLogin.status).toBe(200)
    expect(newLogin.body.token).toBeTruthy()
  })

  it('rejects an unknown reset token', async () => {
    const res = await request(app).get('/api/v1/auth/forgot/123456')
    expect(res.status).toBe(422)
  })
})

describe('change password', () => {
  it('rejects a wrong current password', async () => {
    const email = `chpw-${Date.now()}@test.dev`
    const token = await registerUser(email)

    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'not-my-password', password: 'brandnew123' })
    expect(res.status).toBe(422)
  })

  it('rejects reusing the current password', async () => {
    const email = `chpw-same-${Date.now()}@test.dev`
    const token = await registerUser(email)

    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'secret123', password: 'secret123' })
    expect(res.status).toBe(422)
  })

  it('changes the password when the current one is correct', async () => {
    const email = `chpw-ok-${Date.now()}@test.dev`
    const token = await registerUser(email)

    const res = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'secret123', password: 'brandnew123' })
    expect(res.status).toBe(200)

    // Assert the stored hash directly (the post-change login is covered by auth flows
    // and is subject to the documented sendMail/DB read race).
    const user = await User.where({ email }).firstOrFail()
    expect(await Hash.verify('brandnew123', user.password)).toBe(true)
    expect(await Hash.verify('secret123', user.password)).toBe(false)
  })

  it('requires authentication', async () => {
    await request(app)
      .put('/api/v1/auth/password')
      .send({ current_password: 'secret123', password: 'brandnew123' })
      .expect(401)
  })
})
