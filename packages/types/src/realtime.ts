import type { Id } from './common'
import type { VerificationStatus } from './verification'

/**
 * Realtime transport contracts (Phase 16). Pure, dependency-free helpers shared
 * by the API (server publish) and the dashboard/widget (client subscribe), so
 * channel and event names never drift between them.
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
 * Private channel name builders. All channels are `private-` (Pusher protocol),
 * so a subscription must be authorized server-side against the caller's scope.
 */
export const realtimeChannels = {
  /** Everything in a tenant. */
  tenant: (tenantId: Id): string => `private-tenant-${tenantId}`,
  /** Everything in a project. */
  project: (tenantId: Id, projectId: Id): string => `private-tenant-${tenantId}-project-${projectId}`,
  /** A single verification session (used by the widget via client token). */
  session: (sessionId: Id): string => `private-session-${sessionId}`,
}

/** Parse a private channel name back into its scope, or null if unrecognized. */
export function parseRealtimeChannel(
  channel: string,
):
  | { kind: 'tenant'; tenantId: string }
  | { kind: 'project'; tenantId: string; projectId: string }
  | { kind: 'session'; sessionId: string }
  | null {
  const project = /^private-tenant-(.+)-project-(.+)$/.exec(channel)
  if (project) return { kind: 'project', tenantId: project[1]!, projectId: project[2]! }
  const tenant = /^private-tenant-(.+)$/.exec(channel)
  if (tenant) return { kind: 'tenant', tenantId: tenant[1]! }
  const session = /^private-session-(.+)$/.exec(channel)
  if (session) return { kind: 'session', sessionId: session[1]! }
  return null
}

/** Payload for {@link REALTIME_EVENT.sessionTransition}. */
export interface SessionTransitionEvent {
  session_id: Id
  tenant_id: Id
  project_id: Id | null
  status: VerificationStatus
  previous_status: VerificationStatus | null
}

/** Payload for {@link REALTIME_EVENT.reviewAction}. */
export interface ReviewActionEvent {
  session_id: Id
  tenant_id: Id
  project_id: Id | null
  /** The audit action, e.g. `review.assigned`, `review.note`, `review.approved`. */
  action: string
  actor_id: Id | null
}
