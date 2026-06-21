import { StatusMachine } from '@arkyc/core'
import type { VerificationStatus } from '@arkyc/types'
import type { VerificationSession } from '@app/models/VerificationSession'
import { webhookService } from '@app/services/WebhookService'

/**
 * Apply + persist a session status change (validated against the core state
 * machine), then fan out the matching webhook event. The single choke point for
 * every status transition so webhooks fire consistently.
 */
export async function transitionTo (
  session: VerificationSession,
  to: VerificationStatus,
): Promise<void> {
  session.status = StatusMachine.assert(session.status, to)
  await session.save()
  await webhookService.onStatusChange(session, to)
}
