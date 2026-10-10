import type { ProjectBranding } from '@arkyc/types'
import { Resource } from 'resora'

/** Cross-device handoff config the widget needs (resolved server-side). */
export interface ClientHandoff {
  /** Whether desktop users are offered the QR handoff to their phone. */
  enabled: boolean
  /** Whether a desktop user may continue on the desktop device instead. */
  allow_desktop: boolean
  /** First-party hosted page the QR points to (the phone resumes the session there). */
  url: string
}

/**
 * Realtime settings the widget connects with: the API's public realtime client
 * config (see `Broadcast.clientConfig()`) plus this session's private channel.
 * Under `polling` the widget polls the session endpoint instead.
 */
export interface ClientRealtime {
  transport: string
  /** The private channel this session's events publish to. */
  channel: string
  [param: string]: unknown
}

/** The session view exposed to the widget (Client API). */
export default class ClientSessionResource extends Resource {
  constructor(
    session: object,
    private readonly handoff: ClientHandoff = { enabled: false, allow_desktop: true, url: '' },
    private readonly realtime: ClientRealtime | null = null,
    private readonly branding: ProjectBranding | null = null,
  ) {
    super(session as never)
  }

  data() {
    return {
      id: this.id,
      status: this.status,
      expires_at: this.expiresAt,
      capture_model: this.captureModel ?? 'passive',
      liveness_challenges: this.livenessChallenges ?? [],
      workflow: this.workflow ?? null,
      handoff: this.handoff,
      realtime: this.realtime,
      branding: this.branding,
    }
  }
}
