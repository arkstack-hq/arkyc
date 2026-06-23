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
 * Realtime connection info the widget needs to watch this session live (Phase 16).
 * `transport` selects how: `pusher`/`firebase` subscribe to `channel`; `polling`
 * (and `off`/`memory`) tell the widget to poll the session endpoint instead. The
 * extra fields carry the active transport's public connection params (never
 * secrets); `token` is a per-session Firebase custom token when applicable.
 */
export interface ClientRealtime {
  transport: string
  /** The private channel this session's events publish to. */
  channel: string
  /** Per-session Firebase custom token (firebase transport only). */
  token?: string | null
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
      // Tell the widget which capture flow to run, and (for active
      // liveness) the exact challenge sequence to prompt the user through.
      capture_model: this.captureModel ?? 'passive',
      liveness_challenges: this.livenessChallenges ?? [],
      // The applied workflow (ordered, toggleable stages + skip_ocr), or null for
      // the default pipeline. Drives which steps the widget runs and in what order.
      workflow: this.workflow ?? null,
      // Cross-device handoff config (project setting). The widget leads with the
      // QR on desktop when enabled, and the phone resumes at `url`.
      handoff: this.handoff,
      // How the widget should watch this session live (push transport or polling).
      realtime: this.realtime,
      // Project branding (colours/logo/name) so the widget themes itself to the
      // integrator's project without them passing anything client-side.
      branding: this.branding,
    }
  }
}
