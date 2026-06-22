import type {
  AdminPermissionGroup,
  AdminPermissionKey,
  AnyPermissionGroup,
  AnyPermissionKey,
  PermissionKey,
} from '@arkyc/types'

/** A single permission definition in the catalogue. */
export interface PermissionDefinition {
  name: AnyPermissionKey
  group: AnyPermissionGroup
  description: string
  /** Platform-scope permission. Defaults to a tenant permission when omitted. */
  admin?: boolean
}

/** A platform-admin permission definition (`admin: true`). */
export interface AdminPermissionDefinition extends PermissionDefinition {
  name: AdminPermissionKey
  group: AdminPermissionGroup
  admin: true
}

/** The catalogue of permissions Arkyc recognises and the keys derived from it. */
export class Catalogue {
  /**
   * The full catalogue of permissions Arkyc recognises. `PermissionSync.permissions`
   * (Phase 3) upserts these; seeders reference them directly.
   */
  static readonly ALL: readonly PermissionDefinition[] = [
    { name: 'tenants.view', group: 'tenants', description: 'View tenant details' },
    { name: 'tenants.update', group: 'tenants', description: 'Update tenant settings' },
    { name: 'tenants.delete', group: 'tenants', description: 'Delete the tenant' },

    { name: 'members.view', group: 'members', description: 'View members' },
    { name: 'members.invite', group: 'members', description: 'Invite members' },
    { name: 'members.update', group: 'members', description: 'Update member roles/permissions' },
    { name: 'members.remove', group: 'members', description: 'Remove members' },

    { name: 'projects.view', group: 'projects', description: 'View projects' },
    { name: 'projects.create', group: 'projects', description: 'Create projects' },
    { name: 'projects.update', group: 'projects', description: 'Update projects' },
    { name: 'projects.delete', group: 'projects', description: 'Delete projects' },

    { name: 'api_keys.view', group: 'api_keys', description: 'View API keys' },
    { name: 'api_keys.create', group: 'api_keys', description: 'Create API keys' },
    { name: 'api_keys.revoke', group: 'api_keys', description: 'Revoke API keys' },

    { name: 'webhooks.view', group: 'webhooks', description: 'View webhook endpoints' },
    { name: 'webhooks.create', group: 'webhooks', description: 'Create webhook endpoints' },
    { name: 'webhooks.update', group: 'webhooks', description: 'Update webhook endpoints' },
    { name: 'webhooks.delete', group: 'webhooks', description: 'Delete webhook endpoints' },
    { name: 'webhooks.test', group: 'webhooks', description: 'Send test webhook deliveries' },

    { name: 'sessions.view', group: 'sessions', description: 'View verification sessions' },
    { name: 'sessions.create', group: 'sessions', description: 'Create verification sessions' },
    { name: 'sessions.cancel', group: 'sessions', description: 'Cancel verification sessions' },
    { name: 'sessions.retry', group: 'sessions', description: 'Retry verification sessions' },
    { name: 'sessions.export', group: 'sessions', description: 'Export verification sessions' },

    { name: 'reviews.view', group: 'reviews', description: 'View the review queue' },
    { name: 'reviews.assign', group: 'reviews', description: 'Assign reviews to reviewers' },
    { name: 'reviews.approve', group: 'reviews', description: 'Approve sessions in review' },
    { name: 'reviews.reject', group: 'reviews', description: 'Reject sessions in review' },
    {
      name: 'reviews.request_retry',
      group: 'reviews',
      description: 'Request a verification retry',
    },
    { name: 'reviews.note', group: 'reviews', description: 'Add reviewer notes' },

    { name: 'audit_logs.view', group: 'audit_logs', description: 'View audit logs' },

    { name: 'settings.view', group: 'settings', description: 'View settings' },
    { name: 'settings.update', group: 'settings', description: 'Update settings' },

    { name: 'billing.view', group: 'billing', description: 'View billing' },
    { name: 'billing.update', group: 'billing', description: 'Update billing' },
  ]

  /** Every tenant permission key, derived from the catalogue. */
  static readonly KEYS: readonly PermissionKey[] = Catalogue.ALL.map((p) => p.name as PermissionKey)

  /**
   * The catalogue of platform-admin permissions (the super-admin surface above
   * tenants). Synced by `PermissionSync.adminPermissions`; every row carries
   * `admin: true` and is granted only via `AdminPermission`.
   */
  static readonly ADMIN: readonly AdminPermissionDefinition[] = [
    {
      name: 'admin.tenants.view',
      group: 'admin.tenants',
      admin: true,
      description: 'View all tenants',
    },
    {
      name: 'admin.tenants.manage',
      group: 'admin.tenants',
      admin: true,
      description: 'Create, suspend, and delete tenants',
    },

    {
      name: 'admin.users.view',
      group: 'admin.users',
      admin: true,
      description: 'View platform users',
    },
    {
      name: 'admin.users.manage',
      group: 'admin.users',
      admin: true,
      description: 'Manage platform users',
    },

    {
      name: 'admin.settings.view',
      group: 'admin.settings',
      admin: true,
      description: 'View global settings',
    },
    {
      name: 'admin.settings.update',
      group: 'admin.settings',
      admin: true,
      description: 'Update global settings',
    },

    {
      name: 'admin.audit.view',
      group: 'admin.audit',
      admin: true,
      description: 'View the platform audit log',
    },

    {
      name: 'admin.billing.view',
      group: 'admin.billing',
      admin: true,
      description: 'View platform billing',
    },
    {
      name: 'admin.billing.update',
      group: 'admin.billing',
      admin: true,
      description: 'Manage platform billing',
    },
  ]

  /** Every platform-admin permission key, derived from the admin catalogue. */
  static readonly ADMIN_KEYS: readonly AdminPermissionKey[] = Catalogue.ADMIN.map((p) => p.name)
}
