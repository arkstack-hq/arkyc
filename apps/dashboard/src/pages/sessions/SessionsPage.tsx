import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { VerificationStatus } from '@arkyc/types'
import { api } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { StatusBadge, DecisionBadge } from '@/components/StatusBadge'
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

  const projectsQuery = useQuery({
    queryKey: ['projects', tenantId],
    queryFn: () => api.projects.list(tenantId),
    enabled: canViewProjects,
  })

  const filters = {
    status: status || undefined,
    project_id: projectId || undefined,
  }

  const sessionsQuery = useQuery({
    queryKey: ['sessions', tenantId, filters],
    queryFn: () => api.sessions.list(tenantId, filters),
  })

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
            {(projectsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {sessionsQuery.isLoading ? (
        <Loading />
      ) : sessionsQuery.isError ? (
        <ErrorState error={sessionsQuery.error} />
      ) : (sessionsQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="No sessions"
          description="No verification sessions match these filters."
        />
      ) : (
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
            {(sessionsQuery.data ?? []).map((s) => (
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
      )}
    </div>
  )
}
