import { Hash } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import AuthUserResource from '@app/http/resources/AuthUserResource'
import { User } from '@app/models/User'
import { auth } from 'src/core/auth-instance'

/** Registers a new dashboard user and returns a bearer token. */
export default class RegisteredUserController extends BaseController {
  /**
   * Create a user account and issue its first session token.
   *
   * @returns An AuthUserResource with the issued `token` (HTTP 201).
   */
  async create () {
    const data = await this.validate({
      name: ['required', 'string', 'min:2'],
      email: ['required', 'email', 'unique:users,email'],
      password: ['required', 'string', 'min:8'],
    })

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: await Hash.make(data.password),
    })

    const pat = await auth.create(user)

    return new AuthUserResource(user)
      .additional({
        status: 'success',
        message: 'Your account has been created successfully',
        code: 201,
        token: pat.token,
      })
      .response()
      .setStatusCode(201)
  }
}
