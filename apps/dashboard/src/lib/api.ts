import type {
  ApiKey,
  AuditLog,
  Permission,
  PermissionKey,
  Project,
  ProjectBranding,
  ProjectSettings,
  Role,
  Tenant,
  TenantMember,
  TenantSettings,
  User,
  VerificationSession,
  WebhookEndpoint,
  WebhookEventName,
} from '@arkyc/types'

const TOKEN_KEY = 'arkyc.token'
const BASE = '/api'

/** Error thrown for any non-2xx API response. */
export class ApiError extends Error {
  readonly status: number
  readonly errors?: Record<string, string[]>

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

/** Bearer-token storage (the Arkstack dashboard auth uses a JWT). */
export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
}

/** The standard API envelope. */
interface Envelope<T> {
  status?: string
  message?: string
  data?: T
  errors?: Record<string, string[]>
  [key: string]: unknown
}

async function call<T>(method: string, path: string, body?: unknown): Promise<Envelope<T>> {
  const token = tokenStore.get()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  const json = (text ? JSON.parse(text) : {}) as Envelope<T>

  if (!res.ok) {
    throw new ApiError(json.message ?? `Request failed (${res.status})`, res.status, json.errors)
  }
  return json
}

/** Unwrap `{ data }` from the envelope. */
async function data<T>(method: string, path: string, body?: unknown): Promise<T> {
  const env = await call<T>(method, path, body)
  return env.data as T
}

// --- Request/response shapes the API returns beyond the shared entity types ---

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
  page?: number
}

export interface AuditLogQuery {
  action?: string
  entity_type?: string
  actor_id?: string
  page?: number
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

function query(params: object | undefined): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

const t = (tenantId: string) => `/v1/dashboard/tenants/${tenantId}`
const p = (tenantId: string, projectId: string) => `${t(tenantId)}/projects/${projectId}`

/**
 * Typed client for the Arkyc Dashboard API. Reads the bearer token from
 * {@link tokenStore}; all reads unwrap the `{ data }` envelope, and endpoints
 * that return one-time secrets (api keys, webhook secrets) expose the full body.
 */
export const api = {
  auth: {
    register: (input: { name: string; email: string; password: string }): Promise<AuthResult> =>
      call<User>('POST', '/v1/auth/register', input).then((e) => ({
        user: e.data as User,
        token: e.token as string,
      })),
    login: (input: { email: string; password: string }): Promise<AuthResult> =>
      call<User>('POST', '/v1/auth/login', input).then((e) => ({
        user: e.data as User,
        token: e.token as string,
      })),
    me: (): Promise<User> => data('GET', '/v1/auth/me'),
    logout: (): Promise<unknown> => data('DELETE', '/v1/auth/logout'),
  },

  tenants: {
    list: (): Promise<Tenant[]> => data('GET', '/v1/dashboard/tenants'),
    create: (input: { name: string }): Promise<Tenant> =>
      data('POST', '/v1/dashboard/tenants', input),
    get: (tenantId: string): Promise<Tenant> => data('GET', t(tenantId)),
    update: (
      tenantId: string,
      input: { name?: string; settings?: TenantSettings },
    ): Promise<Tenant> => data('PATCH', t(tenantId), input),
    /** The current user's own role/direct/effective permissions in this tenant. */
    me: (tenantId: string): Promise<MemberPermissions> => data('GET', `${t(tenantId)}/me`),
  },

  projects: {
    list: (tenantId: string): Promise<Project[]> => data('GET', `${t(tenantId)}/projects`),
    create: (tenantId: string, input: CreateProjectInput): Promise<Project> =>
      data('POST', `${t(tenantId)}/projects`, input),
    get: (tenantId: string, projectId: string): Promise<Project> =>
      data('GET', p(tenantId, projectId)),
    update: (
      tenantId: string,
      projectId: string,
      input: Partial<CreateProjectInput>,
    ): Promise<Project> => data('PATCH', p(tenantId, projectId), input),
  },

  apiKeys: {
    list: (tenantId: string, projectId: string): Promise<ApiKey[]> =>
      data('GET', `${p(tenantId, projectId)}/api-keys`),
    create: (
      tenantId: string,
      projectId: string,
      input: { name: string },
    ): Promise<ApiKey & { secret: string }> =>
      call<ApiKey>('POST', `${p(tenantId, projectId)}/api-keys`, input).then((e) => ({
        ...(e.data as ApiKey),
        secret: e.secret as string,
      })),
    revoke: (tenantId: string, projectId: string, keyId: string): Promise<unknown> =>
      data('DELETE', `${p(tenantId, projectId)}/api-keys/${keyId}`),
  },

  webhooks: {
    list: (tenantId: string, projectId: string): Promise<WebhookEndpoint[]> =>
      data('GET', `${p(tenantId, projectId)}/webhooks`),
    create: (
      tenantId: string,
      projectId: string,
      input: CreateWebhookInput,
    ): Promise<WebhookEndpoint & { secret: string }> =>
      call<WebhookEndpoint>('POST', `${p(tenantId, projectId)}/webhooks`, input).then((e) => ({
        ...(e.data as WebhookEndpoint),
        secret: e.secret as string,
      })),
    update: (
      tenantId: string,
      projectId: string,
      webhookId: string,
      input: Partial<CreateWebhookInput> & { status?: string },
    ): Promise<WebhookEndpoint> =>
      data('PATCH', `${p(tenantId, projectId)}/webhooks/${webhookId}`, input),
    remove: (tenantId: string, projectId: string, webhookId: string): Promise<unknown> =>
      data('DELETE', `${p(tenantId, projectId)}/webhooks/${webhookId}`),
    test: (tenantId: string, projectId: string, webhookId: string): Promise<unknown> =>
      data('POST', `${p(tenantId, projectId)}/webhooks/${webhookId}/test`),
  },

  members: {
    list: (tenantId: string): Promise<MemberWithRelations[]> =>
      data('GET', `${t(tenantId)}/members`),
    invite: (tenantId: string, input: { email: string; role_id: string }): Promise<unknown> =>
      data('POST', `${t(tenantId)}/invitations`, input),
    permissions: (tenantId: string, memberId: string): Promise<MemberPermissions> =>
      data('GET', `${t(tenantId)}/members/${memberId}/permissions`),
    assignRole: (
      tenantId: string,
      memberId: string,
      input: { role_id: string },
    ): Promise<unknown> => data('PATCH', `${t(tenantId)}/members/${memberId}`, input),
    addPermission: (
      tenantId: string,
      memberId: string,
      input: { permission: PermissionKey },
    ): Promise<unknown> => data('POST', `${t(tenantId)}/members/${memberId}/permissions`, input),
    removePermission: (
      tenantId: string,
      memberId: string,
      permission: PermissionKey,
    ): Promise<unknown> =>
      data('DELETE', `${t(tenantId)}/members/${memberId}/permissions/${permission}`),
  },

  roles: {
    list: (tenantId: string): Promise<RoleWithPermissions[]> => data('GET', `${t(tenantId)}/roles`),
    create: (tenantId: string, input: CreateRoleInput): Promise<Role> =>
      data('POST', `${t(tenantId)}/roles`, input),
    get: (tenantId: string, roleId: string): Promise<RoleWithPermissions> =>
      data('GET', `${t(tenantId)}/roles/${roleId}`),
    update: (tenantId: string, roleId: string, input: Partial<CreateRoleInput>): Promise<Role> =>
      data('PATCH', `${t(tenantId)}/roles/${roleId}`, input),
  },

  permissions: {
    list: (tenantId: string): Promise<Permission[]> => data('GET', `${t(tenantId)}/permissions`),
  },

  sessions: {
    list: (tenantId: string, q?: SessionListQuery): Promise<VerificationSession[]> =>
      data('GET', `${t(tenantId)}/sessions${query(q)}`),
    get: (tenantId: string, id: string): Promise<VerificationSession & Record<string, unknown>> =>
      data('GET', `${t(tenantId)}/sessions/${id}`),
    approve: (tenantId: string, id: string, input?: { reason?: string }): Promise<unknown> =>
      data('POST', `${t(tenantId)}/sessions/${id}/approve`, input ?? {}),
    reject: (tenantId: string, id: string, input?: { reason?: string }): Promise<unknown> =>
      data('POST', `${t(tenantId)}/sessions/${id}/reject`, input ?? {}),
    requestRetry: (
      tenantId: string,
      id: string,
      input?: { scope?: string; reason?: string },
    ): Promise<unknown> => data('POST', `${t(tenantId)}/sessions/${id}/request-retry`, input ?? {}),
    assign: (
      tenantId: string,
      id: string,
      input: { assigned_to: string | null },
    ): Promise<unknown> => data('POST', `${t(tenantId)}/sessions/${id}/assign`, input),
    markSuspicious: (tenantId: string, id: string, input?: { reason?: string }): Promise<unknown> =>
      data('POST', `${t(tenantId)}/sessions/${id}/suspicious`, input ?? {}),
    note: (tenantId: string, id: string, input: { body: string }): Promise<unknown> =>
      data('POST', `${t(tenantId)}/sessions/${id}/notes`, input),
  },

  auditLogs: {
    list: (tenantId: string, q?: AuditLogQuery): Promise<AuditLog[]> =>
      data('GET', `${t(tenantId)}/audit-logs${query(q)}`),
  },
}

export type Api = typeof api
