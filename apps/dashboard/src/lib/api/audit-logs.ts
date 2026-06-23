import type { AuditLog } from '@arkyc/types'
import { CACHE, type Paginated, alova, params, t } from './client'
import type { AuditLogQuery } from './types'

type AuditLogListParams = AuditLogQuery & { page?: number; limit?: number }

/** Organization audit trail (append-only, paginated). */
export class AuditLogs {
  /**
   * Paginated audit-log list, newest first. Pass `page`/`limit` (usePagination
   * supplies these) alongside any filters.
   */
  static list(organizationId: string, query?: AuditLogListParams) {
    return alova.Get<Paginated<AuditLog>>(`${t(organizationId)}/audit-logs`, {
      name: 'auditLogs:list',
      cacheFor: CACHE,
      params: params(query as Record<string, unknown>),
    })
  }
}
