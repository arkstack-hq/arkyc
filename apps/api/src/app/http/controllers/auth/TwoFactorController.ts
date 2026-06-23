import { TwoFactorMethod, TwoFactorService } from '@app/services/TwoFactorService'

import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import TwoFactorStatusResource from '@app/http/resources/TwoFactorStatusResource'
import { ValidationException } from 'kanun'
import { auth } from 'src/core/auth-instance'
import { str } from '@h3ravel/support'

/** Two-factor enrollment management for the signed-in user (TOTP or emailed codes). */
export default class TwoFactorController extends BaseController {
  /**
   * Return the user's current two-factor status.
   *
   * @param   ctx  The HTTP context (`req.user`).
   * @returns      A TwoFactorStatusResource.
   */
  async show({ req }: HttpContext) {
    return new TwoFactorStatusResource(await TwoFactorService.status(req.user!.id)).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Begin enrollment for a method. For `authenticator` this returns the shared
   * secret and otpauth URL to render as a QR; for `email` it sends a setup code.
   *
   * @param   ctx  The HTTP context (`req.user` and the chosen `method`).
   * @returns      The pending setup payload (HTTP 201).
   */
  async setup({ req }: HttpContext) {
    const { method } = await this.validate({ method: ['required', 'in:authenticator,email'] })
    const user = req.user!

    if (await TwoFactorService.isEnabled(user.id)) {
      throw ValidationException.withMessages({
        method: ['Two-factor authentication is already enabled. Disable it first to re-enroll.'],
      })
    }

    if ((method as TwoFactorMethod) === 'authenticator') {
      const { secret, otpauthUrl } = await TwoFactorService.setupAuthenticator(user)
      
return new EmptyResource({})
        .additional({
          status: 'success',
          message: 'Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.',
          code: 201,
          two_factor: { method, secret, otpauth_url: otpauthUrl },
        })
        .response()
        .setStatusCode(201)
    }

    await TwoFactorService.setupEmail(user)
    const masked = `${str(user.email).before('@').mask('*', 1)}@${str(user.email).after('@')}`

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: `We emailed a verification code to ${masked}. Enter it to confirm.`,
        code: 201,
        two_factor: { method },
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Confirm an in-progress enrollment and enable two-factor, returning one-time
   * recovery codes that are shown to the user exactly once.
   *
   * @param   ctx  The HTTP context (`req.user`, `method`, and `code`).
   * @returns      The recovery codes (HTTP 201).
   */
  async confirm({ req }: HttpContext) {
    const { method, code } = await this.validate({
      method: ['required', 'in:authenticator,email'],
      code: ['required', 'string', 'size:6'],
    })
    const user = req.user!

    if (await TwoFactorService.isEnabled(user.id)) {
      throw ValidationException.withMessages({
        method: ['Two-factor authentication is already enabled.'],
      })
    }

    if (!(await TwoFactorService.verifySetup(user, method as TwoFactorMethod, code.trim()))) {
      throw ValidationException.withMessages({ code: ['That code is incorrect or has expired. Try again.'] })
    }

    const recoveryCodes = await TwoFactorService.enable(user, method as TwoFactorMethod)

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'Two-factor authentication is now enabled. Save your recovery codes somewhere safe.',
        code: 201,
        two_factor: { method, recovery_codes: recoveryCodes },
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Disable two-factor for the user after re-confirming their password.
   *
   * @param   ctx  The HTTP context (`req.user` and `password`).
   * @returns      An EmptyResource (HTTP 200).
   */
  async destroy({ req }: HttpContext) {
    const { password } = await this.validate({ password: ['required', 'string'] })
    const user = req.user!

    if (!(await auth.verify(user.email, password))) {
      throw ValidationException.withMessages({ password: ['That password is incorrect.'] })
    }

    await TwoFactorService.disable(user.id)

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Two-factor authentication has been disabled.',
      code: 200,
    })
  }
}
