import { Hash } from '@arkstack/common'
import { ValidationException, Validator } from 'kanun'

import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { PasswordReset } from '@app/models/PasswordReset'
import { User } from '@app/models/User'
import { sendMail } from '@app/support/mail'

const RESET_TTL_SECONDS = 60 * 15

/** Forgotten-password flow: request a reset code, verify it, set a new password. */
export default class NewPasswordController extends BaseController {
  /**
   * Email a password reset code to the account owner.
   *
   * @returns An EmptyResource confirming the code was sent (HTTP 201).
   */
  async create() {
    const data = await this.validate({ email: ['required', 'email', 'exists:users,email'] })
    const user = await User.where({ email: data.email }).firstOrFail()

    const token = Hash.otp(6, user.email, RESET_TTL_SECONDS).generate()
    const pr = await PasswordReset.create({ email: user.email, phone: null, token })

    const msg = config('messages.password_reset.email')
    sendMail(user.email, msg.template, msg.subject, {
      code: token,
      name: user.name,
      reset_link: pr.link(),
      app_name: config('app.name'),
    })

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'We have emailed you a password reset code.',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Verify that a reset token is valid and unexpired.
   *
   * @returns An EmptyResource confirming validity (HTTP 202).
   */
  async show() {
    const { token } = await Validator.make(this.params, {
      token: ['required', 'string'],
    }).validate()

    const pr = await PasswordReset.fromToken(token).catch(() => null)
    const delta = pr ? Hash.otp(6, pr.email ?? pr.phone!, RESET_TTL_SECONDS).validate({ token: pr.token }) : null

    if (delta === null) {
      if (pr) await pr.delete()
      throw ValidationException.withMessages({
        token: ['Invalid or expired password reset token.'],
      })
    }

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'Password reset verification successful.',
        code: 202,
      })
      .response()
      .setStatusCode(202)
  }

  /**
   * Consume a valid reset token and set the new password.
   *
   * @returns An EmptyResource confirming the password change (HTTP 202).
   */
  async update() {
    const data = await Validator.make(
      { ...this.params, ...this.body },
      {
        token: ['required', 'string'],
        password: ['required', 'string', 'min:8'],
      },
    ).validate()

    const pr = await PasswordReset.fromToken(data.token).catch(() => null)
    const delta = pr ? Hash.otp(6, pr.email ?? pr.phone!, RESET_TTL_SECONDS).validate({ token: pr.token }) : null

    if (delta === null || pr === null) {
      if (pr) await pr.delete()
      throw ValidationException.withMessages({
        token: ['Invalid or expired password reset token.'],
      })
    }

    const user = await User.where({ email: pr.email! }).firstOrFail()
    user.password = await Hash.make(data.password)
    await user.save()
    await pr.delete()

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'Password updated successfully',
        code: 202,
      })
      .response()
      .setStatusCode(202)
  }
}
