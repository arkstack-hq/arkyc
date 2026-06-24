import { useState } from 'react'
import { usePagination } from 'alova/client'
import { Admin } from '@/lib/api'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatDateTime, humanize } from '@/lib/utils'

export default function AdminAuditLogsPage() {
  const [action, setAction] = useState('')

  const {
    data: logs,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) =>
      Admin.auditLogs({
        page: currentPage,
        limit: pageSize,
        action: action || undefined,
      }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 20,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [action],
    },
  )

  return (
    <div>
      <PageHeader title="Audit log" description="Platform-admin activity." />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3 border-b border-border">
          <Input
            className="w-56"
            placeholder="Filter by action…"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            aria-label="Filter by action"
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
                  </TR>
                </THead>
                <TBody>
                  {logs.map((log) => (
                    <TR key={log.id}>
                      <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(log.created_at)}</TD>
                      <TD>{log.actor ? log.actor.name || log.actor.email : '—'}</TD>
                      <TD>{humanize(log.action)}</TD>
                      <TD>{`${log.entity_type} ${log.entity_id ?? ''}`.trim()}</TD>
                    </TR>
                  ))}
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
