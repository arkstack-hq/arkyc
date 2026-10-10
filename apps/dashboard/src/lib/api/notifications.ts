import type { NotificationPreferences, PushPlatform, UserNotification } from '@arkyc/types'
import { CACHE, type Paginated, alova, params, unwrap } from './client'

/** Every notification-mutating method name; reads invalidate on any of them. */
const NOTIFICATION_MUTATIONS = ['notification:read', 'notification:readAll', 'notification:delete']

/** The signed-in user's notifications, preferences and push devices. */
export class Notifications {
  /**
   * Paginated notifications, newest first. Pass `page`/`limit` (usePagination
   * supplies these); `unread` limits the list to unread ones.
   */
  static list(query?: { page?: number; limit?: number; unread?: boolean }) {
    return alova.Get<Paginated<UserNotification> & { unread_count: number }>('/v1/account/notifications', {
      name: 'notifications:list',
      cacheFor: CACHE,
      hitSource: NOTIFICATION_MUTATIONS,
      params: params({ ...query, unread: query?.unread ? 1 : undefined }),
    })
  }

  /** How many notifications are unread. */
  static unreadCount() {
    return alova.Get('/v1/account/notifications', {
      name: 'notifications:unread',
      cacheFor: CACHE,
      hitSource: NOTIFICATION_MUTATIONS,
      params: { unread: '1', limit: '1' },
      transform: (response: { unread_count: number }) => response.unread_count,
    })
  }

  /** Mark one notification as read. */
  static markRead(id: string) {
    return alova.Patch<unknown>(`/v1/account/notifications/${id}/read`, {}, { name: 'notification:read' })
  }

  /** Mark every unread notification as read. */
  static markAllRead() {
    return alova.Patch<unknown>('/v1/account/notifications/read', {}, { name: 'notification:readAll' })
  }

  /** Delete one notification. */
  static remove(id: string) {
    return alova.Delete<unknown>(`/v1/account/notifications/${id}`, {}, { name: 'notification:delete' })
  }

  /** The signed-in user's delivery preferences. */
  static preferences() {
    return alova.Get('/v1/account/notification-preferences', {
      name: 'notifications:preferences',
      cacheFor: CACHE,
      hitSource: ['notifications:updatePreferences'],
      transform: unwrap<NotificationPreferences>,
    })
  }

  /** Update the delivery preferences. */
  static updatePreferences(input: NotificationPreferences) {
    return alova.Patch('/v1/account/notification-preferences', input, {
      name: 'notifications:updatePreferences',
      transform: unwrap<NotificationPreferences>,
    })
  }

  /** Register this device for push notifications. */
  static registerDevice(input: { token: string; platform: PushPlatform; device_name?: string }) {
    return alova.Post<unknown>('/v1/account/push-tokens', input, { name: 'notifications:registerDevice' })
  }

  /** Stop pushing to this device. */
  static unregisterDevice() {
    return alova.Delete<unknown>('/v1/account/push-tokens', {}, { name: 'notifications:unregisterDevice' })
  }
}
