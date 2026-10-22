import { BaseController } from '@controllers/BaseController'
import type { DeepPartial } from '@app/services/GlobalSettingsService'
import EnvironmentResource from '@app/http/resources/EnvironmentResource'
import type { GlobalSettings } from '@arkyc/types'
import GlobalSettingsResource from '@app/http/resources/GlobalSettingsResource'
import { HttpContext } from 'clear-router/types/express'
import { buildEnvironmentSnapshot } from '@app/services/EnvironmentSnapshot'
import { platformAudit } from '@app/services/PlatformAuditLogger'
import { settings } from '@app/services/GlobalSettingsService'

/**
 * Platform-wide settings. Guarded by `canAdmin('admin.settings.*')` — entirely
 * separate from organization scope. Reads/writes go through the typed singleton
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

  /**
   * The API's effective runtime configuration (secret-safe), so admins can spot
   * config drift between environments. Read-only; secrets are reported only as
   * configured/not-set.
   */
  async environment() {
    const snapshot = await buildEnvironmentSnapshot()

    return new EnvironmentResource(snapshot).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Deep-merge a partial patch into the global settings. */
  async update({ req }: HttpContext) {
    await this.validate({
      'platform.name': ['nullable', 'string', 'min:1'],
      'platform.support_email': ['nullable', 'email'],
      'platform.signups_enabled': ['nullable', 'boolean'],
      'capture.model': ['nullable', 'in:passive,active,both'],
      'assets.url_ttl_seconds': ['nullable', 'integer', 'min:60', 'max:86400'],
      'compliance.business_verification_required': ['nullable', 'boolean'],
    })

    const body = (this.body ?? {}) as DeepPartial<GlobalSettings>
    const patch: DeepPartial<GlobalSettings> = {}

    const platform: DeepPartial<GlobalSettings['platform']> = {}

    if (typeof body.platform?.name === 'string') platform.name = body.platform.name

    if (body.platform?.support_email !== undefined) platform.support_email = body.platform.support_email

    if (typeof body.platform?.signups_enabled === 'boolean') platform.signups_enabled = body.platform.signups_enabled

    if (Object.keys(platform).length) patch.platform = platform

    if (body.capture?.model)
      patch.capture = {
        model: body.capture.model,
      }

    if (typeof body.compliance?.business_verification_required === 'boolean') {
      patch.compliance = {
        business_verification_required: body.compliance.business_verification_required,
      }
    }

    if (body.assets?.url_ttl_seconds !== undefined)
      patch.assets = { url_ttl_seconds: Math.trunc(Number(body.assets.url_ttl_seconds)) }

    const next = await settings.update(patch)

    await platformAudit.recordForRequest(req, {
      action: 'platform.settings_updated',
      entityType: 'global_settings',
      entityId: null,
      metadata: { sections: Object.keys(patch) },
    })

    return new GlobalSettingsResource(next).additional({
      status: 'success',
      message: 'Settings updated',
      code: 200,
    })
  }
}
