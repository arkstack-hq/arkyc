import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import { BaseController } from '@controllers/BaseController'
import { UserNotification } from '@app/models/UserNotification'
import UserNotificationCollection from '@app/http/resources/UserNotificationCollection'
import UserNotificationResource from '@app/http/resources/UserNotificationResource'
import EmptyResource from '@app/http/resources/EmptyResource'

/** The signed-in user's in-app notifications. */
export default class NotificationController extends BaseController {
  /**
   * List notifications, newest first. `?unread=1` limits to unread ones.
   *
   * @param ctx
   * @returns
   */
  async index({ req }: HttpContext) {
    const userId = req.user!.id
    const unread = ['1', 'true'].includes(String(req.query.unread))

    const notifications = await UserNotification.query()
      .where({ userId })
      .when(unread, (query) => query.whereNull('readAt'))
      .latest('createdAt')
      .paginate(perPage(req.query))

    const unreadCount = await UserNotification.query().where({ userId }).whereNull('readAt').count()

    return new UserNotificationCollection(notifications).additional({
      status: 'success',
      message: 'OK',
      code: 200,
      unread_count: unreadCount,
    })
  }

  /**
   * Mark one notification as read.
   *
   * @param ctx
   * @returns
   */
  async read({ req }: HttpContext) {
    const notification = await UserNotification.query().where({ id: req.params.id, userId: req.user!.id }).firstOrFail()

    if (!notification.readAt) {
      notification.readAt = new Date()
      await notification.save()
    }

    return new UserNotificationResource(notification)
      .additional({
        status: 'success',
        message: 'Notification marked as read',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Mark all unread notifications as read, or only those in `ids`.
   *
   * @param ctx
   * @returns
   */
  async readAll({ req }: HttpContext) {
    const ids = Array.isArray(this.body?.ids) ? (this.body.ids as unknown[]).map(String) : null

    await UserNotification.query()
      .where({ userId: req.user!.id })
      .whereNull('readAt')
      .when(!!ids, (query) => query.whereIn('id', ids!))
      .updateFrom({ readAt: new Date() })

    return new EmptyResource({})
      .additional({
        status: 'success',
        message: 'Notifications marked as read',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Delete one notification.
   *
   * @param ctx
   * @returns
   */
  async destroy({ req }: HttpContext) {
    const notification = await UserNotification.query().where({ id: req.params.id, userId: req.user!.id }).firstOrFail()

    await notification.delete()

    return new EmptyResource({}).additional({
      status: 'success',
      message: 'Notification deleted',
      code: 200,
    })
  }
}
