import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePagination } from 'alova/client'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { CheckCircle2, Clock, ScrollText, XCircle } from 'lucide-react'
import { Sessions, isForbidden } from '@/lib/api'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { StatusBadge } from '@/components/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'

const BREAKDOWN = [
  { key: 'approved', label: 'Approved', color: 'var(--chart-2)' },
  { key: 'requires_review', label: 'Requires review', color: 'var(--chart-3)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--chart-4)' },
  { key: 'pending', label: 'In progress', color: 'var(--chart-1)' },
] as const

export default function OverviewPage() {
  const organizationId = useOrganizationId()
  const { organization } = useOrganization()

  // Sessions are a paginated endpoint, so usePagination is the right hook. A wide
  // first page drives the status breakdown + recent list; `total` is exact.
  const {
    data: sessions,
    total,
    loading,
    error,
  } = usePagination((page, pageSize) => Sessions.list(organizationId, { page, limit: pageSize }), {
    initialPage: 1,
    initialPageSize: 100,
    data: (res) => res.data,
    total: (res) => res.meta.total,
  })

  const inProgress = (status: string) =>
    !['approved', 'rejected', 'requires_review', 'expired', 'cancelled'].includes(status)

  const counts = useMemo(() => {
    const by = (predicate: (s: (typeof sessions)[number]) => boolean) => sessions.filter(predicate).length
    return {
      approved: by((s) => s.status === 'approved'),
      requires_review: by((s) => s.status === 'requires_review'),
      rejected: by((s) => s.status === 'rejected'),
      pending: by((s) => inProgress(s.status)),
    }
  }, [sessions])

  // Sessions created per day over the trailing two weeks.
  const trend = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = []
    const index = new Map<string, number>()
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      index.set(key, days.length)
      days.push({ date: key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0 })
    }
    for (const s of sessions) {
      const key = new Date(s.created_at).toISOString().slice(0, 10)
      const i = index.get(key)
      if (i !== undefined) days[i]!.count += 1
    }
    return days
  }, [sessions])

  // Week-over-week change per metric: trailing 7 days vs the 7 days before.
  const deltas = useMemo(() => {
    const now = Date.now()
    const week = 7 * 24 * 60 * 60 * 1000
    const inWindow = (created: string, start: number, end: number) => {
      const t = new Date(created).getTime()
      return t >= start && t < end
    }
    const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100)
    const metric = (predicate: (s: (typeof sessions)[number]) => boolean) => {
      const cur = sessions.filter((s) => predicate(s) && inWindow(s.created_at, now - week, now + 1)).length
      const prev = sessions.filter((s) => predicate(s) && inWindow(s.created_at, now - 2 * week, now - week)).length
      return pct(cur, prev)
    }
    return {
      total: metric(() => true),
      approved: metric((s) => s.status === 'approved'),
      requires_review: metric((s) => s.status === 'requires_review'),
      rejected: metric((s) => s.status === 'rejected'),
    }
  }, [sessions])

  const breakdown = BREAKDOWN.map((b) => ({ ...b, value: counts[b.key] })).filter((b) => b.value > 0)

  const recent = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8),
    [sessions],
  )

  const title = `${organization?.name ?? 'Organization'} Overview`

  if (isForbidden(error)) {
    return (
      <div className="p-6 lg:p-8">
        <PageHeader title={title} />
        <p className="text-sm text-muted-foreground">You don&apos;t have access to session metrics.</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <PageHeader title={title} />
        <Loading />
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <PageHeader title={title} />
        <ErrorState error={error} />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title={title} description="Verification activity across this organization." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total sessions"
          value={total ?? sessions.length}
          icon={<ScrollText />}
          delta={{ value: deltas.total, label: 'from last week' }}
        />
        <StatCard
          label="Approved"
          value={counts.approved}
          icon={<CheckCircle2 />}
          delta={{ value: deltas.approved, label: 'from last week' }}
        />
        <StatCard
          label="Requires review"
          value={counts.requires_review}
          icon={<Clock />}
          delta={{ value: deltas.requires_review, label: 'from last week' }}
        />
        <StatCard
          label="Rejected"
          value={counts.rejected}
          icon={<XCircle />}
          delta={{ value: deltas.rejected, label: 'from last week' }}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sessions over time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="sessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--border)' }}
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Sessions"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#sessions)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No sessions yet.</p>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdown}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {breakdown.map((b) => (
                          <Cell key={b.key} fill={b.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {breakdown.map((b) => (
                    <li key={b.key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="size-2.5 rounded-full" style={{ background: b.color }} />
                        {b.label}
                      </span>
                      <span className="font-medium tabular-nums">{b.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          {recent.length === 0 ? (
            <EmptyState title="No sessions yet" description="Sessions will appear here as they come in." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Session</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Created</TH>
                </TR>
              </THead>
              <TBody>
                {recent.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <Link to={`../sessions/${s.id}`} className="font-mono text-xs text-primary hover:underline">
                        {s.id.slice(0, 16)}
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge status={s.status} />
                    </TD>
                    <TD className="text-right whitespace-nowrap text-muted-foreground">
                      {formatDateTime(s.created_at)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
