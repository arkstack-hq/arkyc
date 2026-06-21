import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePagination, useRequest } from 'alova/client'
import type { VerificationStatus } from '@arkyc/types'
import { Projects, Sessions } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { StatusBadge, DecisionBadge } from '@/components/StatusBadge'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Select } from '@/components/ui/select'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'

const STATUSES: VerificationStatus[] = [
  'pending',
  'started',
  'document_submitted',
  'liveness_submitted',
  'processing',
  'requires_review',
  'approved',
  'rejected',
  'expired',
  'cancelled',
]

export default function SessionsPage() {
  const tenantId = useTenantId()
  const { can } = useTenant()
  const [status, setStatus] = useState('')
  const [projectId, setProjectId] = useState('')

  const canViewProjects = can('projects.view')

  // Picker data: all projects in one shot (not a paginated list view).
  const { data: projects } = useRequest(Projects.options(tenantId), {
    immediate: canViewProjects,
    initialData: [],
  })

  // Infinite-scroll list; resets to page 1 whenever a filter changes.
  const {
    data: sessions,
    page,
    isLastPage,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) =>
      Sessions.list(tenantId, {
        page: currentPage,
        limit: pageSize,
        status: status || undefined,
        project_id: projectId || undefined,
      }),
    {
      append: true,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [status, projectId],
    },
  )

  return (
    <div className="p-8">
      <PageHeader title="Sessions" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>

        {canViewProjects ? (
          <Select
            className="w-56"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {projects.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : sessions.length === 0 && loading ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No sessions"
          description="No verification sessions match these filters."
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>User reference</TH>
                <TH>Status</TH>
                <TH>Decision</TH>
                <TH>Risk</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {sessions.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link to={s.id} className="text-primary hover:underline">
                      {s.user_reference ?? '—'}
                    </Link>
                  </TD>
                  <TD>
                    <StatusBadge status={s.status} />
                  </TD>
                  <TD>
                    <DecisionBadge decision={s.final_decision ?? s.auto_decision} />
                  </TD>
                  <TD>{s.risk_score?.toFixed(2) ?? '—'}</TD>
                  <TD className="text-muted-foreground">{formatDateTime(s.created_at)}</TD>
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
