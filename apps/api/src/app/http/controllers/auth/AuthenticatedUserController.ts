import AuthUserResource from '@app/http/resources/AuthUserResource'
import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import { TwoFactorService } from '@app/services/TwoFactorService'
import { User } from '@app/models/User'
import { ValidationException } from 'kanun'
import { auth } from 'src/core/auth-instance'

/** Login (with optional two-factor challenge), current-user, and logout for the dashboard. */
export default class AuthenticatedUserController extends BaseController {
  /**
   * Return the currently authenticated user.
   *
   * @param   ctx  The HTTP context (the user is attached by the auth middleware).
   * @returns      An AuthUserResource for `req.user`.
   */
  async show({ req }: HttpContext) {
    return new AuthUserResource(req.user!).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Verify credentials and either issue a bearer token or, when the account has
   * two-factor enabled, return a short-lived challenge ticket instead of a token.
   *
   * @returns An AuthUserResource with the `token`, or a 2FA challenge envelope.
   */
  async create() {
    const data = await this.validate({
      email: ['required', 'email', 'exists:users,email'],
      password: ['required', 'string'],
    })

    const user = await auth.attempt(data.email, data.password)

    // Two-factor users must clear the challenge before a session token is issued.
    if (await TwoFactorService.isEnabled(user.id)) {
      const method = await TwoFactorService.getMethod(user.id)
      const ticket = await auth.createTemporaryToken(user, '2fa', '10m')
      await TwoFactorService.sendLoginChallenge(user)

      return new EmptyResource({})
        .additional({
          status: 'success',
          message:
            method === 'email'
              ? 'We emailed you a verification code to finish signing in.'
              : 'Enter the code from your authenticator app to finish signing in.',
          code: 200,
          two_factor: { required: true, method, ticket },
        })
        .response()
        .setStatusCode(200)
    }

    return this.issueSession(user, 'You have successfully logged in')
  }

  /**
   * Complete a two-factor login: validate the challenge ticket and submitted
   * code (TOTP, emailed code, or a one-time recovery code), then issue a token.
   *
   * @returns An AuthUserResource with the issued `token`.
   */
  async store() {
    const data = await this.validate({
      ticket: ['required', 'string'],
      code: ['required', 'string'],
    })

    const user = await this.authorizeTicket(data.ticket)

    if (!(await TwoFactorService.verifyChallenge(user, data.code.trim()))) {
      throw ValidationException.withMessages({ code: ['Invalid or expired verification code.'] })
    }

    return this.issueSession(user, 'You have successfully logged in')
  }

  /**
   * Re-send the emailed login code for an in-progress two-factor challenge.
   *
   * @returns An EmptyResource confirming the code was re-sent.
   */
  async resend() {
    const data = await this.validate({ ticket: ['required', 'string'] })
    const user = await this.authorizeTicket(data.ticket)

    if ((await TwoFactorService.getMethod(user.id)) !== 'email') {
      throw ValidationException.withMessages({
        ticket: ['This account uses an authenticator app, so there is no code to resend.'],
      })
    }

    await TwoFactorService.sendLoginChallenge(user)

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'We sent a new verification code to your email.',
      code: 200,
    })
  }

  /**
   * Revoke the current session token (logout).
   *
   * @param   ctx  The HTTP context carrying the bearer `authToken`.
   * @returns      An EmptyResource.
   */
  async destroy({ req }: HttpContext) {
    await auth.logout(req.authToken)

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'You have successfully been logged out',
      code: 200,
    })
  }

  /** Issue a personal access token for a fully-authenticated user and stamp the login. */
  private async issueSession(user: User, message: string) {
    const pat = await auth.create(user)

    user.lastLoginAt = new Date()
    await user.save()

    return new AuthUserResource(user)
      .additional({ status: 'success', message, code: 200, token: pat.token })
      .response()
      .setStatusCode(200)
  }

  /** Resolve a two-factor challenge ticket to its user, surfacing a clean field error if stale. */
  private async authorizeTicket(ticket: string): Promise<User> {
    try {
      return (await auth.authorizeTemporaryToken(ticket, '2fa')) as User
    } catch {
      throw ValidationException.withMessages({
        ticket: ['Your sign-in session expired. Please enter your email and password again.'],
      })
    }
  }
}
