import AuthUserResource from '@app/http/resources/AuthUserResource'
import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import { auth } from 'src/core/auth-instance'

/** Login, current-user, and logout for the dashboard. */
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
   * Verify credentials and issue a bearer token.
   *
   * @returns An AuthUserResource with the issued `token`.
   */
  async create() {
    const data = await this.validate({
      email: ['required', 'email', 'exists:users,email'],
      password: ['required', 'string'],
    })

    const user = await auth.attempt(data.email, data.password)
    const pat = await auth.create(user)

    user.lastLoginAt = new Date()
    await user.save()

    return new AuthUserResource(user)
      .additional({
        status: 'success',
        message: 'You have successfully logged in',
        code: 200,
        token: pat.token,
      })
      .response()
      .setStatusCode(200)
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
}
