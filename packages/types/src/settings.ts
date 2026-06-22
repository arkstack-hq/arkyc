import type { Entity } from './common'

/** Realtime transport for verification events (Phase 16). */
export type RealtimeTransport = 'soketi' | 'firebase' | 'off'

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
}
