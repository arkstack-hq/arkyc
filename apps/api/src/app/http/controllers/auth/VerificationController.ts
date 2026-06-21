import { Hash } from '@arkstack/common'

import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import { ValidationException } from 'kanun'
import { str } from '@h3ravel/support'
import { sendMail } from '@app/support/mail'

/** Email verification: send a one-time code, then confirm it. */
export default class VerificationController extends BaseController {
  /**
   * Send a verification code to the authenticated user's email.
   *
   * @param   ctx  The HTTP context (`req.user` is the recipient).
   * @returns      An EmptyResource confirming the code was sent (HTTP 201).
   */
  async create({ req }: HttpContext) {
    await this.validate({ object: ['nullable', 'in:email'] })
    const user = req.user!

    // Stateless time-based OTP keyed by the user's email (no storage needed).
    const code = Hash.otp(6, user.email, 60 * 15).generate()
    const msg = config('messages.verification.email')

    sendMail(user.email, msg.template, msg.subject, {
      code,
      name: user.name,
      app_name: config('app.name'),
    })

    const masked = `${str(user.email).before('@').mask('*', 1)}@${str(user.email).after('@')}`

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: `Email verification code sent to ${masked}`,
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Confirm an emailed verification code and mark the email verified.
   *
   * @param   ctx  The HTTP context (`req.user` and the submitted `code`).
   * @returns      An EmptyResource confirming verification (HTTP 202).
   */
  async update({ req }: HttpContext) {
    const form = await this.validate({ code: ['required', 'string', 'size:6'] })
    const user = req.user!

    const delta = Hash.otp(6, user.email, 60 * 15).validate({ token: form.code })
    if (delta === null) {
      throw ValidationException.withMessages({ code: ['Invalid or expired verification code.'] })
    }

    user.emailVerifiedAt = new Date()
    await user.save()

    const msg = config('messages.verification_complete.email')
    sendMail(user.email, msg.template, msg.subject, {
      name: user.name,
      app_name: config('app.name'),
    })

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'Email verification complete.',
        code: 202,
      })
      .response()
      .setStatusCode(202)
  }
}
