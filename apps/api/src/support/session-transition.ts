import { StatusMachine } from '@arkyc/core'
import { REALTIME_EVENT, type SessionTransitionEvent, type VerificationStatus } from '@arkyc/types'
import type { VerificationSession } from '@app/models/VerificationSession'
import { webhookService } from '@app/services/WebhookService'
import { realtime } from '@app/services/RealtimeService'
import { sessionChannels } from './realtime-channels'

/**
 * Apply + persist a session status change (validated against the core state
 * machine), then fan out the matching webhook event and a realtime broadcast.
 * The single choke point for every status transition, so webhooks + realtime
 * fire consistently.
 */
export async function transitionTo(
  session: VerificationSession,
  to: VerificationStatus,
  opts: { force?: boolean } = {},
): Promise<void> {
  const previous = session.status
  // `force` is for human overrides (a manager re-deciding a session): it bypasses
  // the automated state machine so any status — including a finalized one — can be
  // overridden. Webhooks + realtime still fire so integrators see the change.
  session.status = opts.force ? to : StatusMachine.assert(session.status, to)
  await session.save()
  await webhookService.onStatusChange(session, to)

  const payload: SessionTransitionEvent = {
    session_id: session.id,
    organization_id: session.organizationId,
    project_id: session.projectId,
    status: to,
    previous_status: previous,
  }
  await realtime.broadcast(sessionChannels(session), REALTIME_EVENT.sessionTransition, payload)
}
