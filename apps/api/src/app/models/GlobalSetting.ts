import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { GlobalSettings } from '@arkyc/types'

/**
 * The single persisted row backing platform-wide {@link GlobalSettings}. Managed
 * through the `GlobalSettingsService` singleton, never queried directly by
 * controllers. Stored as one JSON blob and merged over defaults on read.
 */
export class GlobalSetting extends Model {
  protected static override table = 'global_settings'

  declare id: string
  declare settings: GlobalSettings
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    settings: 'json',
  }
}
