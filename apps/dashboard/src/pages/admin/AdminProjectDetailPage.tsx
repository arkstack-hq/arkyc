import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { ArrowLeft, CheckCircle2, Clock, Gauge, ScrollText } from 'lucide-react'
import { ACCESS_CAPABILITIES, ACCESS_CAPABILITY_KEYS, type VerificationThresholds } from '@arkyc/types'
import { ExtendedAccess } from '@/lib/api'
import { RISK_SIGNAL_LABEL } from '@/lib/risk'
import { formatDateTime, humanize } from '@/lib/utils'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { SessionTrendChart } from '@/components/SessionTrendChart'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { VERIFICATION_STATUS } from '@/pages/settings/BusinessVerificationPage'

const THRESHOLD_LABEL: Record<keyof VerificationThresholds, string> = {
  documentQualityThreshold: 'Document quality',
  ocrConfidenceThreshold: 'OCR confidence',
  livenessThreshold: 'Liveness',
  faceMatchThreshold: 'Face match',
  addressThreshold: 'Address',
  livenessRejectThreshold: 'Liveness reject floor',
  faceMatchRejectThreshold: 'Face match reject floor',
}

const GRANT_VARIANT = { none: 'muted', pending: 'warning', granted: 'success', revoked: 'destructive' } as const

/** One project in depth for platform admins: usage, outcomes, configuration and access. */
export default function AdminProjectDetailPage() {
  const { organizationId, projectId } = useParams()
  const {
    data: project,
    loading,
    error,
  } = useRequest(ExtendedAccess.projectDetail(organizationId!, projectId!), {
    immediate: !!organizationId && !!projectId,
  })

  if (error) return <ErrorState error={error} />
  if (loading || !project) return <Loading />

  const verification = VERIFICATION_STATUS[project.organization.verification_status]

  return (
    <div>
      <Link
        to={`/admin/organizations/${project.organization.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {project.organization.name}
      </Link>

      <PageHeader
        title={project.name}
        description={`${project.slug} · created ${formatDateTime(project.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{humanize(project.environment)}</Badge>
            <Badge variant="outline">{humanize(project.status)}</Badge>
            <Badge variant={verification.variant}>Business {verification.label.toLowerCase()}</Badge>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Sessions"
          value={project.stats.total}
          icon={<ScrollText />}
          hint={`${project.stats.last_30_days} in 30 days`}
        />
        <StatCard
          label="Approval rate"
          value={`${Math.round(project.stats.approval_rate * 100)}%`}
          icon={<CheckCircle2 />}
          hint="of decided sessions"
        />
        <StatCard label="Awaiting review" value={project.stats.requires_review} icon={<Clock />} />
        <StatCard label="Last 7 days" value={project.stats.last_7_days} icon={<Gauge />} hint="new sessions" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sessions over time</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionTrendChart trend={project.stats.trend} height="h-48" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 text-sm">
            <Row label="Active API keys" value={project.counts.api_keys} />
            <Row label="Active webhooks" value={project.counts.webhooks} />
            <Row label="Project members" value={project.counts.members} />
            <Heading>Thresholds</Heading>
            {(Object.keys(THRESHOLD_LABEL) as (keyof VerificationThresholds)[]).map((key) => (
              <Row key={key} label={THRESHOLD_LABEL[key]} value={project.thresholds[key] ?? '—'} />
            ))}
            <Heading>Extended access</Heading>
            {ACCESS_CAPABILITY_KEYS.map((capability) => {
              const status = project.extended_access[capability]?.status ?? 'none'

              return (
                <Row
                  key={capability}
                  label={ACCESS_CAPABILITIES[capability].label}
                  value={<Badge variant={GRANT_VARIANT[status]}>{status}</Badge>}
                />
              )
            })}
            <Heading>Risk signals, last 30 days</Heading>
            {project.stats.top_risk_signals.length ? (
              project.stats.top_risk_signals.map((signal) => (
                <Row key={signal.key} label={RISK_SIGNAL_LABEL[signal.key] ?? signal.key} value={signal.count} />
              ))
            ) : (
              <p className="text-muted-foreground">None open.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          {project.recent_sessions.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Reference</TH>
                  <TH>Status</TH>
                  <TH>Reason</TH>
                  <TH>Risk</TH>
                  <TH>Created</TH>
                </TR>
              </THead>
              <TBody>
                {project.recent_sessions.map((session) => (
                  <TR key={session.id}>
                    <TD className="font-mono text-xs">{session.user_reference ?? session.id.slice(0, 8)}</TD>
                    <TD>
                      <StatusBadge status={session.status as never} />
                    </TD>
                    <TD className="text-muted-foreground">{humanize(session.decision_reason)}</TD>
                    <TD className="tabular-nums">{session.risk_score == null ? '—' : session.risk_score.toFixed(2)}</TD>
                    <TD className="text-muted-foreground">{formatDateTime(session.created_at)}</TD>
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

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</p>
}
