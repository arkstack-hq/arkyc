import type {
  PermissionKey,
  ProjectBranding,
  ProjectSettings,
  Role,
  TenantMember,
  User,
  Permission,
  WebhookEventName,
} from '@arkyc/types'

/** Result of a login/register call: the user plus the issued JWT. */
export interface AuthResult {
  user: User
  token: string
}

export interface MemberWithRelations extends TenantMember {
  user?: User
  role?: Role
}

export interface RoleWithPermissions extends Role {
  permissions?: Permission[]
}

export interface MemberPermissions {
  role_permissions: PermissionKey[]
  direct_permissions: PermissionKey[]
  effective_permissions: PermissionKey[]
}

export interface SessionListQuery {
  status?: string
  decision_reason?: string
  project_id?: string
  assigned_to?: string
}

export interface AuditLogQuery {
  action?: string
  entity_type?: string
  actor_id?: string
}

export interface CreateProjectInput {
  name: string
  environment?: string
  settings?: ProjectSettings
  branding?: ProjectBranding
}

export interface CreateRoleInput {
  name: string
  description?: string
  permissions?: PermissionKey[]
}

export interface CreateWebhookInput {
  url: string
  events: WebhookEventName[]
}
