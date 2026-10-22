import type { Entity } from './common'

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
    /** Whether new organization sign-ups are accepted. */
    signups_enabled: boolean
  }
  /** Default capture/liveness flow offered to widgets (Phase 17). */
  capture: {
    model: CaptureModel
  }
  /** Signed session-asset links (captured document/selfie images). */
  /** Rules organizations must meet before going live. */
  compliance: {
    /** Production projects need a verified business. Development and staging stay open. */
    business_verification_required: boolean
  }
  assets: {
    /**
     * How long a signed asset URL stays valid, in seconds. The link embeds its
     * own expiry, so a change only affects newly minted URLs; existing links
     * keep their original window. Bounded to [60, 86400] (1 minute to 24 hours).
     */
    url_ttl_seconds: number
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
  capture: {
    model: 'passive',
  },
  compliance: {
    business_verification_required: true,
  },
  assets: {
    url_ttl_seconds: 1800,
  },
}
