import { Resource } from 'resora'

/** Whether (and where) the widget may offer cross-device handoff for this session. */
export interface ClientHandoff {
  enabled: boolean
  desktop_only: boolean
}

/** The session view exposed to the widget (Client API). */
export default class ClientSessionResource extends Resource {
  constructor(
    session: object,
    private readonly handoff: ClientHandoff = { enabled: false, desktop_only: false },
  ) {
    super(session as never)
  }

  data() {
    return {
      id: this.id,
      status: this.status,
      expires_at: this.expiresAt,
      // Phase 17: tell the widget which capture flow to run, and (for active
      // liveness) the exact challenge sequence to prompt the user through.
      capture_model: this.captureModel ?? 'passive',
      liveness_challenges: this.livenessChallenges ?? [],
      // Cross-device handoff config (project setting); the widget renders a QR
      // when enabled (and, if desktop_only, only on desktop).
      handoff: this.handoff,
    }
  }
}
