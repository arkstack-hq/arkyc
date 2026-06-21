import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { Sessions } from '@/lib/api'
import { useTenantId } from '@/contexts/tenant-context'
import { PageHeader, Loading, ErrorState } from '@/components/States'
import { StatusBadge, DecisionBadge } from '@/components/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatDateTime, humanize } from '@/lib/utils'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

function CheckGroup({ title, value }: { title: string; value: unknown }) {
  if (!isRecord(value)) return null
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{humanize(title)}</p>
      <div className="rounded-md border border-border p-3">
        {Object.entries(value).map(([k, v]) => (
          <Row key={k} label={humanize(k)}>
            {isRecord(v) ? JSON.stringify(v) : String(v ?? '—')}
          </Row>
        ))}
      </div>
    </div>
  )
}

export default function SessionDetailPage() {
  const tenantId = useTenantId()
  const { sessionId } = useParams()

  const { data, loading, error } = useRequest(Sessions.get(tenantId, sessionId as string), {
    immediate: !!sessionId,
  })

  const checks = data && isRecord(data.checks) ? data.checks : null

  return (
    <div className="p-8">
      <PageHeader
        title="Session"
        actions={
          <Link to="../" className="text-sm text-primary hover:underline">
            ← Sessions
          </Link>
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : data ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <Row label="Status">
                <StatusBadge status={data.status} />
              </Row>
              <Row label="Auto decision">
                <DecisionBadge decision={data.auto_decision} />
              </Row>
              <Row label="Final decision">
                <DecisionBadge decision={data.final_decision} />
              </Row>
              <Row label="Decision reason">{humanize(data.decision_reason)}</Row>
              <Row label="Risk score">{data.risk_score?.toFixed(2) ?? '—'}</Row>
              <Row label="Completed at">{formatDateTime(data.completed_at)}</Row>
              <Row label="Reviewed at">{formatDateTime(data.reviewed_at)}</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <Row label="ID">
                <span className="font-mono text-xs">{data.id}</span>
              </Row>
              <Row label="User reference">{data.user_reference ?? '—'}</Row>
              <Row label="Project ID">
                <span className="font-mono text-xs">{data.project_id}</span>
              </Row>
              <Row label="Created at">{formatDateTime(data.created_at)}</Row>
              <Row label="Expires at">{formatDateTime(data.expires_at)}</Row>
            </CardContent>
          </Card>

          {checks ? (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Checks</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <CheckGroup title="document" value={checks.document} />
                <CheckGroup title="liveness" value={checks.liveness} />
                <CheckGroup title="face_match" value={checks.face_match} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
