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

/** The session view exposed to the widget (Client API). */
export default class ClientSessionResource extends Resource {
  constructor(
    session: object,
    private readonly handoff: ClientHandoff = { enabled: false, allow_desktop: true, url: '' },
  ) {
    super(session as never)
  }

  data() {
    return {
      id: this.id,
      status: this.status,
      expires_at: this.expiresAt,
      // Tell the widget which capture flow to run, and (for active
      // liveness) the exact challenge sequence to prompt the user through.
      capture_model: this.captureModel ?? 'passive',
      liveness_challenges: this.livenessChallenges ?? [],
      // Cross-device handoff config (project setting). The widget leads with the
      // QR on desktop when enabled, and the phone resumes at `url`.
      handoff: this.handoff,
    }
  }
}
