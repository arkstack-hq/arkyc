import { realtimeChannels } from '@arkyc/types'
import type { VerificationSession } from '@app/models/VerificationSession'

/**
 * The private channels a session's realtime events fan out to: its tenant, its
 * project, and the session itself (the widget subscribes to the last via a
 * client token).
 */
export function sessionChannels(session: VerificationSession): string[] {
  return [
    realtimeChannels.tenant(session.tenantId),
    realtimeChannels.project(session.tenantId, session.projectId),
    realtimeChannels.session(session.id),
  ]
}
