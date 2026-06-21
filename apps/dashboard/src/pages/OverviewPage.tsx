import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { VerificationSession } from '@arkyc/types'
import { api, ApiError } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime, humanize } from '@/lib/utils'

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function OverviewPage() {
  const tenantId = useTenantId()
  const { tenant } = useTenant()

  const sessionsQuery = useQuery({
    queryKey: ['sessions', tenantId, {}],
    queryFn: () => api.sessions.list(tenantId),
  })

  const title = `${tenant?.name ?? 'Tenant'} Overview`

  const forbidden = sessionsQuery.error instanceof ApiError && sessionsQuery.error.status === 403

  if (forbidden) {
    return (
      <div className="p-6">
        <PageHeader title={title} />
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to session metrics.
        </p>
      </div>
    )
  }

  if (sessionsQuery.isLoading) {
    return (
      <div className="p-6">
        <PageHeader title={title} />
        <Loading />
      </div>
    )
  }

  if (sessionsQuery.isError) {
    return (
      <div className="p-6">
        <PageHeader title={title} />
        <ErrorState error={sessionsQuery.error} />
      </div>
    )
  }

  const sessions: VerificationSession[] = sessionsQuery.data ?? []
  const countBy = (status: string) => sessions.filter((s) => s.status === status).length

  const recent = [...sessions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  return (
    <div className="p-6">
      <PageHeader title={title} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total sessions" value={sessions.length} />
        <Metric label="Approved" value={countBy('approved')} />
        <Metric label="Requires review" value={countBy('requires_review')} />
        <Metric label="Rejected" value={countBy('rejected')} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`../sessions/${s.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm hover:opacity-80"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.id.slice(0, 12)}
                    </span>
                    <span className="font-medium">{humanize(s.status)}</span>
                    <span className="text-muted-foreground">{formatDateTime(s.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
