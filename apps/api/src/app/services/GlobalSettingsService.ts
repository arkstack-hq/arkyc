import { DEFAULT_GLOBAL_SETTINGS, type GlobalSettings } from '@arkyc/types'
import { GlobalSetting } from '@app/models/GlobalSetting'

/** A recursively-optional view of `T` (every nested key optional). */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

/**
 * Typed singleton over the {@link GlobalSetting} row. Reads always merge the
 * stored value over {@link DEFAULT_GLOBAL_SETTINGS} so every key is present even
 * before anything is saved; writes deep-merge a partial patch. Later phases read
 * these at runtime (e.g. Phase 16 realtime transport).
 */
export class GlobalSettingsService {
  /** The current settings, stored values merged over defaults. */
  async current(): Promise<GlobalSettings> {
    const row = await GlobalSetting.query().first()

    return this.merge(DEFAULT_GLOBAL_SETTINGS, (row?.settings ?? {}) as DeepPartial<GlobalSettings>)
  }

  /** Deep-merge `patch` into the current settings and persist. Idempotent row. */
  async update(patch: DeepPartial<GlobalSettings>): Promise<GlobalSettings> {
    const next = this.merge(await this.current(), patch)

    const row = await GlobalSetting.query().first()
    if (row) {
      row.settings = next
      await row.save()
    } else {
      await GlobalSetting.create({ settings: next })
    }

    return next
  }

  /** Merge a partial over a base, one level into each known section. */
  private merge(base: GlobalSettings, patch: DeepPartial<GlobalSettings>): GlobalSettings {
    return {
      platform: { ...base.platform, ...(patch.platform ?? {}) },
      realtime: { ...base.realtime, ...(patch.realtime ?? {}) },
    }
  }
}

/** Shared singleton settings service. */
export const settings = new GlobalSettingsService()
