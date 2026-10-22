import { BaseController } from '@controllers/BaseController'
import EmptyResource from '@app/http/resources/EmptyResource'
import { HttpContext } from 'clear-router/types/express'
import { PersonalAccessToken } from '@app/models/PersonalAccessToken'
import PushTokenResource from '@app/http/resources/PushTokenResource'
import { UserPushToken } from '@app/models/UserPushToken'

/**
 * Device push registration. A token belongs to the login session that registered
 * it, so logging out removes it.
 */
export default class PushTokenController extends BaseController {
  /**
   * Register (or refresh) this device's push token.
   *
   * @param ctx
   * @returns
   */
  async create({ req }: HttpContext) {
    const data = await this.validate({
      token: ['required', 'string', 'max:4096'],
      platform: ['required', 'in:ios,android,web'],
      device_name: ['nullable', 'string', 'max:255'],
    })

    const user = req.user!
    const session = await PersonalAccessToken.query().where({ token: req.authToken, userId: user.id }).firstOrFail()

    // The same device token may have been registered under an older login.
    await UserPushToken.query().where({ token: data.token }).where('personalAccessTokenId', '!=', session.id).delete()

    const existing = await UserPushToken.query().where({ personalAccessTokenId: session.id }).first()
    const attributes = {
      userId: user.id,
      token: data.token,
      platform: data.platform,
      deviceName: data.device_name ?? null,
      isActive: true,
      lastRegisteredAt: new Date(),
    }

    let pushToken: UserPushToken

    if (existing) {
      Object.assign(existing, attributes)
      await existing.save()
      pushToken = existing
    } else {
      pushToken = await UserPushToken.create({ ...attributes, personalAccessTokenId: session.id })
    }

    return new PushTokenResource(pushToken)
      .additional({
        status: 'success',
        message: 'Device registered for push notifications',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Stop pushing to this device.
   *
   * @param ctx
   * @returns
   */
  async destroy({ req }: HttpContext) {
    const session = await PersonalAccessToken.query().where({ token: req.authToken, userId: req.user!.id }).first()

    if (session) await UserPushToken.query().where({ personalAccessTokenId: session.id }).delete()

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Device unregistered from push notifications',
      code: 200,
    })
  }
}
