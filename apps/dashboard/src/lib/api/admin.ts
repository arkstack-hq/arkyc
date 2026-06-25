import type { AdminPermissionKey, GlobalSettings, Metadata, Organization } from '@arkyc/types'
import { CACHE, type Paginated, alova, params, unwrap } from './client'

/** The caller's platform-admin standing. */
export interface AdminMe {
  is_admin: boolean
  permissions: AdminPermissionKey[]
}

/** Comprehensive platform-wide statistics for the admin overview. */
export interface AdminStats {
  totals: {
    organizations: number
    users: number
    projects: number
    sessions: number
    api_keys: number
    webhooks: number
    reviews: number
    admins: number
  }
  users: { active: number; restricted: number; suspended: number; admins: number }
  sessions: {
    total: number
    by_status: Record<string, number>
    approved: number
    rejected: number
    requires_review: number
    approval_rate: number
    last_7_days: number
    last_30_days: number
  }
  ai_access: { pending: number; granted: number; revoked: number }
  trend: { date: string; count: number }[]
}

/** A single config value on the environment panel. The server never sends secret values. */
export interface EnvItem {
  label: string
  /** `ok` plain value · `warn` insecure default · `set`/`unset` secret indicators. */
  status: 'ok' | 'warn' | 'set' | 'unset'
  value: string
}

/** A titled group of related config values. */
export interface EnvSection {
  title: string
  items: EnvItem[]
}

/** Secret-safe snapshot of the API's effective runtime configuration. */
export interface EnvironmentConfig {
  generated_at: string
  node_env: string
  version: string
  sections: EnvSection[]
}

/** A partial patch over the global settings sections. */
export interface AdminSettingsPatch {
  platform?: Partial<GlobalSettings['platform']>
  realtime?: Partial<GlobalSettings['realtime']>
  capture?: Partial<GlobalSettings['capture']>
}

/** Account standing. */
export type UserStatus = 'active' | 'restricted' | 'suspended'

/** A platform user row in the admin users list / detail. */
export interface AdminUser {
  id: string
  name: string
  email: string
  status: UserStatus
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

/** A platform-admin audit entry (no organization scope; actor is an admin user). */
export interface PlatformAuditLog {
  id: string
  actor_id: string | null
  actor_type: string
  actor: { id: string; name: string; email: string } | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Metadata | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface AdminAuditLogParams {
  page?: number
  limit?: number
  action?: string
  entity_type?: string
}

/** Platform-admin surface (above organizations). Guarded server-side by `canAdmin(...)`. */
export class Admin {
  /** The current user's effective admin permissions (empty for non-admins). */
  static me() {
    return alova.Get('/v1/admin/me', {
      name: 'admin:me',
      cacheFor: CACHE,
      transform: unwrap<AdminMe>,
    })
  }

  /** Comprehensive platform-wide statistics for the admin overview. */
  static stats() {
    return alova.Get('/v1/admin/stats', {
      name: 'admin:stats',
      cacheFor: CACHE,
      transform: unwrap<AdminStats>,
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

  /** The API's effective runtime configuration (secret-safe) for spotting drift. */
  static environment() {
    return alova.Get('/v1/admin/config', {
      name: 'admin:config',
      cacheFor: CACHE,
      transform: unwrap<EnvironmentConfig>,
    })
  }

  /** Deep-merge a partial patch into the platform settings. */
  static updateSettings(patch: AdminSettingsPatch) {
    return alova.Patch('/v1/admin/settings', patch, {
      name: 'admin:settings:update',
      transform: unwrap<GlobalSettings>,
    })
  }

  /** Paginated list of every organization on the platform, newest first. */
  static organizations(query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<Organization>>('/v1/admin/organizations', {
      name: 'admin:organizations',
      cacheFor: CACHE,
      params: params(query as Record<string, unknown>),
    })
  }

  /** Paginated list of platform users, newest first. */
  static users(query?: AdminUserListParams) {
    return alova.Get<Paginated<AdminUser>>('/v1/admin/users', {
      name: 'admin:users',
      cacheFor: CACHE,
      hitSource: ['admin:users:grant', 'admin:users:revoke', 'admin:user:status'],
      params: params(query as Record<string, unknown>),
    })
  }

  /** A single platform user (admin standing + account status). */
  static user(userId: string) {
    return alova.Get(`/v1/admin/users/${userId}`, {
      name: 'admin:user',
      cacheFor: CACHE,
      hitSource: ['admin:users:grant', 'admin:users:revoke', 'admin:user:status', 'admin:user:password'],
      transform: unwrap<AdminUser>,
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

  /** Set a user's account standing (`active` / `restricted` / `suspended`). */
  static setUserStatus(userId: string, status: UserStatus) {
    return alova.Post(
      `/v1/admin/users/${userId}/status`,
      { status },
      { name: 'admin:user:status', transform: unwrap<AdminUser> },
    )
  }

  /** Set a new password for a user (admin reset). */
  static resetUserPassword(userId: string, password: string) {
    return alova.Post<unknown>(`/v1/admin/users/${userId}/password`, { password }, { name: 'admin:user:password' })
  }

  /** Paginated platform-admin audit log, newest first. */
  static auditLogs(query?: AdminAuditLogParams) {
    return alova.Get<Paginated<PlatformAuditLog>>('/v1/admin/audit-logs', {
      name: 'admin:auditLogs',
      cacheFor: CACHE,
      params: params(query as Record<string, unknown>),
    })
  }
}
