import { ValidationException, Validator } from 'kanun'

import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { Hash } from '@arkstack/common'
import { HttpContext } from 'clear-router/types/express'
import { PasswordReset } from '@app/models/PasswordReset'
import { PersonalAccessToken } from '@app/models/PersonalAccessToken'
import { User } from '@app/models/User'
import { auth } from 'src/core/auth-instance'
import { sendMail } from '@app/support/mail'

const RESET_TTL_SECONDS = 60 * 15
const resetKey = (identity: string) => `${identity}:password-reset`

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

    const token = Hash.otp(6, resetKey(user.email), RESET_TTL_SECONDS).generate()

    await PasswordReset.where({ email: user.email }).delete()
    const pr = await PasswordReset.create({
      email: user.email,
      phone: null,
      token,
      attempts: 0,
    })

    const msg = config('messages.password_reset.email')

    await sendMail(user.email, msg.template, msg.subject, {
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
  async show({ req }: HttpContext) {
    const data = await Validator.make(
      { ...this.params, email: req.query.email },
      {
        token: ['required', 'string'],
        email: ['nullable', 'email'],
      },
    ).validate()

    await this.redeem(data.token, String(data.email))

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
        email: ['nullable', 'email'],
        password: ['required', 'string', 'min:8'],
      },
    ).validate()

    const pr = await this.redeem(data.token, data.email)
    const user = await User.where({ email: pr.email! }).firstOrFail()

    user.password = await Hash.make(data.password)
    await user.save()
    await PasswordReset.where({ email: pr.email! }).delete()
    await PersonalAccessToken.where({ userId: user.id }).delete()

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'Password updated successfully',
        code: 202,
      })
      .response()
      .setStatusCode(202)
  }

  /**
   * Change the signed-in user's password after re-confirming the current one.
   *
   * @param   ctx  The HTTP context (`req.user`, `current_password`, `password`).
   * @returns      An EmptyResource confirming the change (HTTP 200).
   */
  async change({ req }: HttpContext) {
    const data = await this.validate({
      current_password: ['required', 'string'],
      password: ['required', 'string', 'min:8'],
    })
    const user = req.user!

    if (!(await auth.verify(user.email, data.current_password))) {
      throw ValidationException.withMessages({ current_password: ['That password is incorrect.'] })
    }

    if (await Hash.verify(data.password, user.password)) {
      throw ValidationException.withMessages({
        password: ['Your new password must be different from the current one.'],
      })
    }

    user.password = await Hash.make(data.password)
    await user.save()

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Your password has been changed.',
      code: 200,
    })
  }

  /** The reset matching the submitted code and email, or a validation error. */
  private async redeem(token: string, email?: string | null): Promise<PasswordReset> {
    const submitted = PasswordReset.parse(token, email)

    if (!submitted.email) {
      throw ValidationException.withMessages({
        email: ['Enter the email address the reset code was sent to.'],
      })
    }

    const pr = await PasswordReset.redeem(submitted.email, submitted.code)
    const valid =
      pr !== null && Hash.otp(6, resetKey(pr.email!), RESET_TTL_SECONDS).validate({ token: pr.token }) !== null

    if (!valid) {
      if (pr) await pr.delete()
      throw ValidationException.withMessages({
        token: ['Invalid or expired password reset token.'],
      })
    }

    return pr
  }
}
