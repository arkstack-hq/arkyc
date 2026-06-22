import { useState } from 'react'
import { usePagination } from 'alova/client'
import { Admin } from '@/lib/api'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Input } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatDateTime, humanize } from '@/lib/utils'

export default function AdminAuditLogsPage() {
  const [action, setAction] = useState('')

  const {
    data: logs,
    page,
    isLastPage,
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
      append: true,
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="w-56"
          placeholder="Filter by action…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
        />
      </div>

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
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </TD>
                  <TD>{log.actor ? log.actor.name || log.actor.email : '—'}</TD>
                  <TD>{humanize(log.action)}</TD>
                  <TD>{`${log.entity_type} ${log.entity_id ?? ''}`.trim()}</TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <InfiniteScroll
            onLoadMore={() => update({ page: page + 1 })}
            isLast={isLastPage}
            loading={loading}
          />
        </>
      )}
    </div>
  )
}
