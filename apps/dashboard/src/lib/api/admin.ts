import type { AdminPermissionKey, AuditLog, GlobalSettings, Tenant } from '@arkyc/types'
import { CACHE, type Paginated, alova, params, unwrap } from './client'

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

/** A platform user row in the admin users list. */
export interface AdminUser {
  id: string
  name: string
  email: string
  last_login_at: string | null
  email_verified_at: string | null
  created_at: string
  is_admin: boolean
}

interface AdminUserListParams {
  page?: number
  limit?: number
  search?: string
}

interface AdminAuditLogParams {
  page?: number
  limit?: number
  action?: string
  entity_type?: string
  tenant_id?: string
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

  /** Paginated list of platform users, newest first. */
  static users(query?: AdminUserListParams) {
    return alova.Get<Paginated<AdminUser>>('/v1/admin/users', {
      name: 'admin:users',
      cacheFor: CACHE,
      hitSource: ['admin:users:grant', 'admin:users:revoke'],
      params: params(query as Record<string, unknown>),
    })
  }

  /** Grant a user the platform-owner admin role. */
  static grantUserAdmin(userId: string) {
    return alova.Post<unknown>(`/v1/admin/users/${userId}/admin`, undefined, {
      name: 'admin:users:grant',
    })
  }

  /** Revoke all platform-admin grants from a user. */
  static revokeUserAdmin(userId: string) {
    return alova.Delete<unknown>(`/v1/admin/users/${userId}/admin`, undefined, {
      name: 'admin:users:revoke',
    })
  }

  /** Paginated platform-wide audit log (across all tenants), newest first. */
  static auditLogs(query?: AdminAuditLogParams) {
    return alova.Get<Paginated<AuditLog>>('/v1/admin/audit-logs', {
      name: 'admin:auditLogs',
      cacheFor: CACHE,
      params: params(query as Record<string, unknown>),
    })
  }
}
