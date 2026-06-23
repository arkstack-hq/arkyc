import type { Entity } from './common'

/**
 * Realtime transport for verification events (Phase 16). `pusher` covers both
 * hosted Pusher Channels (default, via a cluster) and self-hosted soketi (opt-in,
 * via a host) — they share the Pusher protocol. `polling` carries no push
 * transport: clients poll the session endpoint instead (a universal fallback that
 * needs no infrastructure). `off` disables live updates entirely.
 */
export type RealtimeTransport = 'pusher' | 'firebase' | 'polling' | 'off'

/**
 * Which capture/liveness flow the widget offers (Phase 17). `passive` = the
 * current selfie flow; `active` = guided active-liveness challenges; `both` =
 * offer active, falling back to passive on failure/unsupported devices.
 */
export type CaptureModel = 'passive' | 'active' | 'both'

/**
 * Platform-wide settings, managed by platform admins on the `/admin` surface and
 * read by the app at runtime. A single typed record (see {@link GlobalSetting}),
 * always merged over {@link DEFAULT_GLOBAL_SETTINGS} so every key is present.
 */
export interface GlobalSettings {
  /** Branding/basics for the whole platform. */
  platform: {
    name: string
    support_email: string | null
    /** Whether new tenant sign-ups are accepted. */
    signups_enabled: boolean
  }
  /** Realtime delivery configuration (consumed in Phase 16). */
  realtime: {
    transport: RealtimeTransport
  }
  /** Default capture/liveness flow offered to widgets (Phase 17). */
  capture: {
    model: CaptureModel
  }
}

/** The persisted singleton row backing {@link GlobalSettings}. */
export interface GlobalSetting extends Entity {
  settings: GlobalSettings
}

/** Defaults applied when a settings key is unset. */
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  platform: {
    name: 'Arkyc',
    support_email: null,
    signups_enabled: true,
  },
  realtime: {
    transport: 'off',
  },
  capture: {
    model: 'passive',
  },
}
