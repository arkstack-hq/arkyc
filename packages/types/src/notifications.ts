import type { Id } from './common'

/** Kinds of in-app notification a user can receive. */
export const NOTIFICATION_TYPE = {
  /** A verification session was assigned to you for review. */
  reviewAssigned: 'review.assigned',
  /** A verification session in a project you review needs a manual decision. */
  sessionNeedsReview: 'session.requires_review',
  /** Someone else approved or rejected a session assigned to you. */
  reviewDecided: 'review.decided',
  /** A webhook endpoint you maintain exhausted its delivery retries. */
  webhookFailing: 'webhook.failing',
  /** You were invited to join an organization. */
  invitationReceived: 'invitation.received',
  /** Watchlist screening matched a session in a project you review. */
  screeningHit: 'screening.hit',
  /** A platform admin approved or rejected your organization's business verification. */
  businessVerificationDecided: 'business_verification.decided',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE]

/** A user's notification delivery preferences. */
export interface NotificationPreferences {
  /** Also push notifications to the user's registered devices. */
  push: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push: true,
}

/** Platforms a device push token can be registered for. */
export type PushPlatform = 'ios' | 'android' | 'web'

/** A stored in-app notification, as the API returns it. */
export interface UserNotification {
  id: Id
  type: NotificationType | string | null
  title: string
  description: string
  action_text: string | null
  /** A dashboard path, e.g. `/o/acme/sessions/<id>`. */
  action_link: string | null
  meta: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}
