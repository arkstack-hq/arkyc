import { useState } from 'react'
import { usePagination } from 'alova/client'
import { AuditLogs } from '@/lib/api'
import { useOrganizationId } from '@/contexts/organization-context'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatDateTime, humanize } from '@/lib/utils'

export default function AuditLogsPage() {
  const organizationId = useOrganizationId()
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')

  // Infinite-scroll list; resets to page 1 whenever a filter changes.
  const {
    data: logs,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) =>
      AuditLogs.list(organizationId, {
        page: currentPage,
        limit: pageSize,
        action: action || undefined,
        entity_type: entityType || undefined,
      }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [action, entityType],
    },
  )

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title="Audit Logs" description="Every privileged action taken in this organization." />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3 border-b border-border">
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
        </CardHeader>

        <CardContent className="px-2 pb-2">
          {error ? (
            <ErrorState error={error} />
          ) : logs.length === 0 && loading ? (
            <Loading />
          ) : logs.length === 0 ? (
            <EmptyState title="No audit logs" description="No activity matches these filters." />
          ) : (
            <>
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
                      log.metadata && Object.keys(log.metadata).length > 0 ? JSON.stringify(log.metadata) : null
                    return (
                      <TR key={log.id}>
                        <TD className="text-muted-foreground whitespace-nowrap">{formatDateTime(log.created_at)}</TD>
                        <TD>{`${log.actor_type} ${log.actor_id ?? ''}`.trim()}</TD>
                        <TD>{humanize(log.action)}</TD>
                        <TD>{`${log.entity_type} ${log.entity_id ?? ''}`.trim()}</TD>
                        <TD className="max-w-xs truncate text-xs text-muted-foreground" title={metadata ?? undefined}>
                          {metadata ?? '—'}
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>

              <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
