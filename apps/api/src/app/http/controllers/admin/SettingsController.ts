import { BaseController } from '@controllers/BaseController'
import GlobalSettingsResource from '@app/http/resources/GlobalSettingsResource'
import { settings } from '@app/services/GlobalSettingsService'
import type { DeepPartial } from '@app/services/GlobalSettingsService'
import type { GlobalSettings } from '@arkyc/types'

/**
 * Platform-wide settings. Guarded by `canAdmin('admin.settings.*')` — entirely
 * separate from tenant scope. Reads/writes go through the typed singleton
 * `GlobalSettingsService`, which merges over defaults.
 */
export default class SettingsController extends BaseController {
  /** Show the current global settings (merged over defaults). */
  async show() {
    const current = await settings.current()

    return new GlobalSettingsResource(current).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Deep-merge a partial patch into the global settings. */
  async update() {
    await this.validate({
      'platform.name': ['nullable', 'string', 'min:1'],
      'platform.support_email': ['nullable', 'email'],
      'platform.signups_enabled': ['nullable', 'boolean'],
      'realtime.transport': ['nullable', 'in:soketi,firebase,off'],
    })

    const body = (this.body ?? {}) as DeepPartial<GlobalSettings>
    const patch: DeepPartial<GlobalSettings> = {}

    const platform: DeepPartial<GlobalSettings['platform']> = {}
    if (typeof body.platform?.name === 'string') platform.name = body.platform.name
    if (body.platform?.support_email !== undefined) platform.support_email = body.platform.support_email
    if (typeof body.platform?.signups_enabled === 'boolean')
      platform.signups_enabled = body.platform.signups_enabled
    if (Object.keys(platform).length) patch.platform = platform

    if (body.realtime?.transport) patch.realtime = { transport: body.realtime.transport }

    const next = await settings.update(patch)

    return new GlobalSettingsResource(next).additional({
      status: 'success',
      message: 'Settings updated',
      code: 200,
    })
  }
}
