import type { Id } from './common'
import type { VerificationStatus } from './verification'

/**
 * Realtime contracts shared by the API (server publish) and the dashboard and
 * widget (client subscribe), so channel and event names never drift between them.
 */

/** Events the API broadcasts. Clients react by invalidating their caches. */
export const REALTIME_EVENT = {
  /** A verification session changed status (the `transitionTo` choke point). */
  sessionTransition: 'session.transition',
  /** A reviewer acted on a session (assign/note/suspicious/decision/retry). */
  reviewAction: 'review.action',
} as const

export type RealtimeEventName = (typeof REALTIME_EVENT)[keyof typeof REALTIME_EVENT]

/**
 * Private channel name builders. Every channel is `private-`, so a subscription
 * must be authorized by the API. Segments are dot-separated so the API's channel
 * rules can capture each id.
 */
export const realtimeChannels = {
  /** A user's own notifications. */
  user: (userId: Id): string => `private-user.${userId}`,
  /** Everything in an organization. */
  organization: (organizationId: Id): string => `private-organization.${organizationId}`,
  /** Everything in a project. */
  project: (organizationId: Id, projectId: Id): string => `private-organization.${organizationId}.project.${projectId}`,
  /** A single verification session (used by the widget via client token). */
  session: (sessionId: Id): string => `private-session.${sessionId}`,
}

/** Payload for {@link REALTIME_EVENT.sessionTransition}. */
export interface SessionTransitionEvent {
  session_id: Id
  organization_id: Id
  project_id: Id | null
  status: VerificationStatus
  previous_status: VerificationStatus | null
}

/** Payload for {@link REALTIME_EVENT.reviewAction}. */
export interface ReviewActionEvent {
  session_id: Id
  organization_id: Id
  project_id: Id | null
  /** The audit action, e.g. `review.assigned`, `review.note`, `review.approved`. */
  action: string
  actor_id: Id | null
}
