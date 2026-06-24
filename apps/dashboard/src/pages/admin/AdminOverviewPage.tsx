import { useMemo } from 'react'
import { useRequest } from 'alova/client'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import {
  Boxes,
  Building2,
  CheckCircle2,
  Clock,
  Gauge,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
  XCircle,
} from 'lucide-react'
import { Admin } from '@/lib/api'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function AdminOverviewPage() {
  const { data: stats, loading, error } = useRequest(Admin.stats(), { immediate: true })

  const trend = useMemo(() => (stats?.trend ?? []).map((d) => ({ label: fmtDay(d.date), count: d.count })), [stats])

  const breakdown = useMemo(() => {
    if (!stats) return []
    const s = stats.sessions.by_status
    const n = (key: string) => s[key] ?? 0
    const inProgress = n('pending') + n('started') + n('document_submitted') + n('liveness_submitted') + n('processing')
    return [
      { key: 'approved', label: 'Approved', value: n('approved'), color: 'var(--chart-2)' },
      { key: 'requires_review', label: 'Requires review', value: n('requires_review'), color: 'var(--chart-3)' },
      { key: 'rejected', label: 'Rejected', value: n('rejected'), color: 'var(--chart-4)' },
      { key: 'in_progress', label: 'In progress', value: inProgress, color: 'var(--chart-1)' },
      { key: 'closed', label: 'Expired / cancelled', value: n('expired') + n('cancelled'), color: 'var(--chart-5)' },
    ].filter((b) => b.value > 0)
  }, [stats])

  if (loading && !stats) return <Loading />
  if (error) return <ErrorState error={error} />
  if (!stats) return null

  const { totals, users, sessions, ai_access } = stats
  const approvalPct = `${(sessions.approval_rate * 100).toFixed(1)}%`

  return (
    <div>
      <PageHeader title="Platform overview" description="Activity and health across the whole platform." />

      {/* Headline totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Organizations"
          value={totals.organizations}
          icon={<Building2 />}
          hint={`${totals.projects} projects`}
        />
        <StatCard
          label="Users"
          value={totals.users}
          icon={<Users />}
          hint={`${users.active} active · ${totals.admins} admins`}
        />
        <StatCard
          label="Sessions"
          value={totals.sessions}
          icon={<ScrollText />}
          hint={`${sessions.last_7_days} in the last 7 days`}
        />
        <StatCard label="Approval rate" value={approvalPct} icon={<Gauge />} hint={`${sessions.approved} approved`} />
      </div>

      {/* Session outcomes */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Approved" value={sessions.approved} icon={<CheckCircle2 />} />
        <StatCard label="Requires review" value={sessions.requires_review} icon={<Clock />} />
        <StatCard label="Rejected" value={sessions.rejected} icon={<XCircle />} />
        <StatCard label="Last 30 days" value={sessions.last_30_days} icon={<ScrollText />} hint="new sessions" />
      </div>

      {/* Trend + status breakdown */}
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
                    <linearGradient id="admin-sessions" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#admin-sessions)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session status</CardTitle>
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

      {/* Users · AI access · resources */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Users by standing</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList
              rows={[
                { label: 'Active', value: users.active },
                { label: 'Restricted', value: users.restricted },
                { label: 'Suspended', value: users.suspended },
                { label: 'Platform admins', value: users.admins, icon: <ShieldCheck className="size-3.5" /> },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" /> AI processing access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList
              rows={[
                { label: 'Pending requests', value: ai_access.pending },
                { label: 'Granted', value: ai_access.granted },
                { label: 'Revoked', value: ai_access.revoked },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform resources</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList
              rows={[
                { label: 'Projects', value: totals.projects, icon: <Boxes className="size-3.5" /> },
                { label: 'API keys', value: totals.api_keys, icon: <KeyRound className="size-3.5" /> },
                { label: 'Webhook endpoints', value: totals.webhooks, icon: <Webhook className="size-3.5" /> },
                { label: 'Reviews', value: totals.reviews, icon: <ScrollText className="size-3.5" /> },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BreakdownList({ rows }: { rows: { label: string; value: number; icon?: React.ReactNode }[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            {r.icon}
            {r.label}
          </span>
          <span className="font-semibold tabular-nums text-foreground">{r.value}</span>
        </li>
      ))}
    </ul>
  )
}
