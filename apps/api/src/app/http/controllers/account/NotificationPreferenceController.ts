import { HttpContext } from 'clear-router/types/express'
import { GenericResource } from 'resora'
import { BaseController } from '@controllers/BaseController'
import { userNotifier } from '@app/notifications/UserNotifier'

/** The signed-in user's notification delivery preferences. */
export default class NotificationPreferenceController extends BaseController {
  /**
   * Show the effective preferences.
   *
   * @param ctx
   * @returns
   */
  async show({ req }: HttpContext) {
    return new GenericResource(userNotifier.preferences(req.user!)).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Update the preferences.
   *
   * @param ctx
   * @returns
   */
  async update({ req }: HttpContext) {
    const data = await this.validate({ push: ['required', 'boolean'] })
    const user = req.user!

    user.notificationPreferences = { ...(user.notificationPreferences ?? {}), push: Boolean(data.push) }
    await user.save()

    return new GenericResource(userNotifier.preferences(user)).additional({
      status: 'success',
      message: 'Notification preferences updated',
      code: 200,
    })
  }
}
