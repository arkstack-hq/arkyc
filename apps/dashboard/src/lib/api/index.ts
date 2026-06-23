/**
 * Concern-scoped Arkyc Dashboard API.
 *
 * Each class exposes static methods returning alova `Method` objects — named and
 * cached for reads, named for mutations — wired together with `hitSource` so a
 * successful mutation auto-invalidates the reads it affects. Consume them with
 * alova's strategy hooks (useRequest / useWatcher / usePagination / useForm).
 */

export { ApiKeys } from './api-keys'
export { Admin } from './admin'
export type { AdminMe, AdminSettingsPatch, AdminUser } from './admin'
export { Auth } from './auth'
export { AuditLogs } from './audit-logs'
export { Members } from './members'
export { Permissions } from './permissions'
export { Projects } from './projects'
export { Realtime } from './realtime'
export { Roles } from './roles'
export { Sessions } from './sessions'
export { Tenants } from './tenants'
export { Webhooks } from './webhooks'

export {
  CACHE,
  RequestException,
  ValidationException,
  alova,
  clearAuthToken,
  errorMessage,
  errorStatus,
  fetchSessionMedia,
  hasAuthToken,
  isForbidden,
} from './client'
export type { ApiException, Envelope, Paginated } from './client'

export type {
  AuditLogQuery,
  AuthResult,
  CreateProjectInput,
  CreateRoleInput,
  CreateWebhookInput,
  MemberPermissions,
  MemberWithRelations,
  RoleWithPermissions,
  SessionListQuery,
} from './types'
