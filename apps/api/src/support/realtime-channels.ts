import { Broadcast, type RealtimeBroadcastPayload } from '@arkstack/notifications'
import { realtimeChannels } from '@arkyc/types'
import type { VerificationSession } from '@app/models/VerificationSession'
import { reportError } from './observability'

/**
 * The private channels a session's realtime events fan out to: its organization, its
 * project, and the session itself (the widget subscribes to the last via a
 * client token).
 */
export function sessionChannels(session: VerificationSession): string[] {
  return [
    realtimeChannels.organization(session.organizationId),
    realtimeChannels.project(session.organizationId, session.projectId),
    realtimeChannels.session(session.id),
  ]
}

/**
 * Broadcast an event without letting a transport failure reach the caller.
 *
 * @param channels
 * @param event
 * @param payload
 */
export async function broadcastSafely(channels: string[], event: string, payload: object): Promise<void> {
  try {
    await Broadcast.broadcast(channels, event, payload as RealtimeBroadcastPayload)
  } catch (error) {
    reportError(error, { scope: 'realtime.broadcast', event })
  }
}
