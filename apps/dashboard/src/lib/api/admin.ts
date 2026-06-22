import type { AdminPermissionKey, GlobalSettings, Tenant } from '@arkyc/types'
import { CACHE, alova, unwrap } from './client'

/** The caller's platform-admin standing. */
export interface AdminMe {
  is_admin: boolean
  permissions: AdminPermissionKey[]
}

/** A partial patch over the global settings sections. */
export interface AdminSettingsPatch {
  platform?: Partial<GlobalSettings['platform']>
  realtime?: Partial<GlobalSettings['realtime']>
}

/** Platform-admin surface (above tenants). Guarded server-side by `canAdmin(...)`. */
export class Admin {
  /** The current user's effective admin permissions (empty for non-admins). */
  static me() {
    return alova.Get('/v1/admin/me', {
      name: 'admin:me',
      cacheFor: CACHE,
      transform: unwrap<AdminMe>,
    })
  }

  /** Read the platform-wide settings (merged over defaults). */
  static settings() {
    return alova.Get('/v1/admin/settings', {
      name: 'admin:settings',
      cacheFor: CACHE,
      hitSource: ['admin:settings:update'],
      transform: unwrap<GlobalSettings>,
    })
  }

  /** Deep-merge a partial patch into the platform settings. */
  static updateSettings(patch: AdminSettingsPatch) {
    return alova.Patch('/v1/admin/settings', patch, {
      name: 'admin:settings:update',
      transform: unwrap<GlobalSettings>,
    })
  }

  /** List every tenant on the platform. */
  static tenants() {
    return alova.Get('/v1/admin/tenants', {
      name: 'admin:tenants',
      cacheFor: CACHE,
      transform: unwrap<Tenant[]>,
    })
  }
}
