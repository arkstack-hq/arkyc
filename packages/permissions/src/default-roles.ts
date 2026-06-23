import type { AdminPermissionKey, AdminRoleSlug, PermissionKey, SystemRoleSlug } from '@arkyc/types'

import { Catalogue } from './catalogue'

/** Definition of a built-in system role. */
export interface DefaultRoleDefinition {
  slug: SystemRoleSlug
  name: string
  description: string
  /** Resolved permission keys; `*` is expanded to the full catalogue. */
  permissions: readonly PermissionKey[]
}

/** Definition of a built-in platform-admin role (not organization-scoped). */
export interface AdminRoleDefinition {
  slug: AdminRoleSlug
  name: string
  description: string
  permissions: readonly AdminPermissionKey[]
}

const REVIEWER_PERMISSIONS: PermissionKey[] = [
  'sessions.view',
  'reviews.view',
  'reviews.assign',
  'reviews.approve',
  'reviews.reject',
  'reviews.request_retry',
  'reviews.note',
]

const DEVELOPER_PERMISSIONS: PermissionKey[] = [
  'projects.view',
  'api_keys.view',
  'api_keys.create',
  'api_keys.revoke',
  'webhooks.view',
  'webhooks.create',
  'webhooks.update',
  'webhooks.delete',
  'webhooks.test',
  'workflows.view',
  'workflows.create',
  'workflows.update',
  'workflows.delete',
  'sessions.view',
  'sessions.create',
  'audit_logs.view',
  'settings.view',
]

const READONLY_PERMISSIONS: PermissionKey[] = Catalogue.KEYS.filter((p) => p.endsWith('.view'))

/** Admin gets broad management, minus the most destructive/owner-only actions. */
const ADMIN_PERMISSIONS: PermissionKey[] = Catalogue.KEYS.filter(
  (p) => p !== 'organizations.delete' && p !== 'billing.update',
)

/** The built-in system roles seeded for every organization, and lookup by slug. */
export class DefaultRoles {
  /**
   * The built-in system roles seeded for every organization, with their default
   * permission sets. `owner` always receives the full catalogue.
   */
  static readonly ALL: readonly DefaultRoleDefinition[] = [
    {
      slug: 'owner',
      name: 'Owner',
      description: 'Full access to everything in the organization',
      permissions: Catalogue.KEYS,
    },
    {
      slug: 'admin',
      name: 'Admin',
      description: 'Broad organization and project management',
      permissions: ADMIN_PERMISSIONS,
    },
    {
      slug: 'reviewer',
      name: 'Reviewer',
      description: 'Review and decide verification sessions',
      permissions: REVIEWER_PERMISSIONS,
    },
    {
      slug: 'developer',
      name: 'Developer',
      description: 'Integration: API keys, webhooks, sessions, and logs',
      permissions: DEVELOPER_PERMISSIONS,
    },
    {
      slug: 'readonly',
      name: 'Read-only',
      description: 'View-only access across the organization',
      permissions: READONLY_PERMISSIONS,
    },
  ]

  /**
   * Look up a default role definition by slug.
   *
   * @param slug
   * @returns
   */
  static bySlug(slug: SystemRoleSlug): DefaultRoleDefinition {
    const role = DefaultRoles.ALL.find((r) => r.slug === slug)
    if (!role) throw new Error(`Unknown system role: ${slug}`)
    return role
  }
}

/** The built-in platform-admin roles, seeded once for the whole platform. */
export class AdminRoles {
  /**
   * The platform-admin roles and their default permission sets. `platform-owner`
   * receives the full admin catalogue and is granted to the first owner via
   * `AdminPermission` ("sync ownership").
   */
  static readonly ALL: readonly AdminRoleDefinition[] = [
    {
      slug: 'platform-owner',
      name: 'Platform Owner',
      description: 'Full access to the platform admin surface',
      permissions: Catalogue.ADMIN_KEYS,
    },
  ]

  /**
   * Look up a platform-admin role definition by slug.
   *
   * @param slug
   * @returns
   */
  static bySlug(slug: AdminRoleSlug): AdminRoleDefinition {
    const role = AdminRoles.ALL.find((r) => r.slug === slug)
    if (!role) throw new Error(`Unknown admin role: ${slug}`)
    return role
  }
}
