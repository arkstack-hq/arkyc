import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AuditLog } from '@arkyc/types'
import { api } from '@/lib/api'
import { useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { Input } from '@/components/ui/input'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatDateTime, humanize } from '@/lib/utils'

export default function AuditLogsPage() {
  const tenantId = useTenantId()
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')

  const filters = {
    action: action || undefined,
    entity_type: entityType || undefined,
  }

  const logsQuery = useQuery({
    queryKey: ['audit-logs', tenantId, filters],
    queryFn: () => api.auditLogs.list(tenantId, filters),
  })

  const logs = (logsQuery.data ?? []) as AuditLog[]

  return (
    <div className="p-8">
      <PageHeader title="Audit Logs" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="w-56"
          placeholder="Filter by action…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
        />
        <Input
          className="w-56"
          placeholder="Filter by entity type…"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          aria-label="Filter by entity type"
        />
      </div>

      {logsQuery.isLoading ? (
        <Loading />
      ) : logsQuery.isError ? (
        <ErrorState error={logsQuery.error} />
      ) : logs.length === 0 ? (
        <EmptyState title="No audit logs" description="No activity matches these filters." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Metadata</TH>
            </TR>
          </THead>
          <TBody>
            {logs.map((log) => {
              const metadata =
                log.metadata && Object.keys(log.metadata).length > 0
                  ? JSON.stringify(log.metadata)
                  : null
              return (
                <TR key={log.id}>
                  <TD className="text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </TD>
                  <TD>{`${log.actor_type} ${log.actor_id ?? ''}`.trim()}</TD>
                  <TD>{humanize(log.action)}</TD>
                  <TD>{`${log.entity_type} ${log.entity_id ?? ''}`.trim()}</TD>
                  <TD
                    className="max-w-xs truncate text-xs text-muted-foreground"
                    title={metadata ?? undefined}
                  >
                    {metadata ?? '—'}
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
    </div>
  )
}
