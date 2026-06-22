import { Link } from 'react-router-dom'
import { usePagination } from 'alova/client'
import { Sessions, isForbidden } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
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

  // Sessions are a paginated endpoint, so usePagination is the right hook. A wide
  // first page drives the status breakdown + recent list; `total` is exact.
  const {
    data: sessions,
    total,
    loading,
    error,
  } = usePagination((page, pageSize) => Sessions.list(tenantId, { page, limit: pageSize }), {
    initialPage: 1,
    initialPageSize: 100,
    data: (res) => res.data,
    total: (res) => res.meta.total,
  })

  const title = `${tenant?.name ?? 'Tenant'} Overview`

  if (isForbidden(error)) {
    return (
      <div className="p-6">
        <PageHeader title={title} />
        <p className="text-sm text-muted-foreground">You don&apos;t have access to session metrics.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title={title} />
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title={title} />
        <ErrorState error={error} />
      </div>
    )
  }

  const countBy = (status: string) => sessions.filter((s) => s.status === status).length

  const recent = [...sessions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  return (
    <div className="p-6">
      <PageHeader title={title} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total sessions" value={total ?? sessions.length} />
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
                    <span className="font-mono text-xs text-muted-foreground">{s.id.slice(0, 12)}</span>
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
