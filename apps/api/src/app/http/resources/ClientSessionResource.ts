import { Resource } from 'resora'

/** The session view exposed to the widget (Client API). */
export default class ClientSessionResource extends Resource {
  data() {
    return {
      id: this.id,
      status: this.status,
      expires_at: this.expiresAt,
      // Phase 17: tell the widget which capture flow to run, and (for active
      // liveness) the exact challenge sequence to prompt the user through.
      capture_model: this.captureModel ?? 'passive',
      liveness_challenges: this.livenessChallenges ?? [],
    }
  }
}
