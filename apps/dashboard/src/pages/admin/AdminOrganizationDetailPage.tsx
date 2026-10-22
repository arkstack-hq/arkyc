import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePagination, useRequest } from 'alova/client'
import { ArrowLeft, CheckCircle2, Clock, Gauge, ScrollText } from 'lucide-react'
import { BusinessVerifications, ExtendedAccess, type AdminProject, type AccessGrantStatus } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { RISK_SIGNAL_LABEL } from '@/lib/risk'
import { SessionTrendChart } from '@/components/SessionTrendChart'
import { StatCard } from '@/components/ui/stat-card'
import { VERIFICATION_STATUS } from '@/pages/settings/BusinessVerificationPage'
import { useAdmin } from '@/contexts/admin-context'
import { useConfirm } from '@/components/Confirm'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

const VARIANT: Record<AccessGrantStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  none: 'muted',
  pending: 'warning',
  granted: 'success',
  revoked: 'destructive',
}

export default function AdminOrganizationDetailPage() {
  const { organizationId } = useParams()
  const { can } = useAdmin()
  const confirm = useConfirm()
  const canManage = can('admin.extended_access.manage')
  const [busyId, setBusyId] = useState<string | null>(null)

  const {
    data: org,
    loading: orgLoading,
    error: orgError,
  } = useRequest(ExtendedAccess.organization(organizationId!), {
    immediate: !!organizationId,
  })

  const {
    data: projects,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) =>
      ExtendedAccess.organizationProjects(organizationId!, { page: currentPage, limit: pageSize }),
    { append: false, initialPage: 1, initialPageSize: 15, data: (res) => res.data, total: (res) => res.meta.total },
  )

  const { send: setVerified, loading: settingVerified } = useRequest(
    (verified: boolean) => BusinessVerifications.setOrganization(organizationId!, verified),
    { immediate: false },
  )

  const { send: grant } = useRequest((projectId: string) => ExtendedAccess.grant(projectId, 'ai'), { immediate: false })
  const { send: revoke } = useRequest((projectId: string) => ExtendedAccess.revoke(projectId, 'ai'), {
    immediate: false,
  })

  if (orgLoading && !org) return <Loading />
  if (orgError) return <ErrorState error={orgError} />
  if (!org) return null

  const toggleVerified = async (verified: boolean) => {
    const ok = await confirm({
      title: verified ? `Mark ${org.name} verified?` : `Mark ${org.name} unverified?`,
      description: verified
        ? 'It can run production projects without submitting business verification.'
        : 'Its production projects stop accepting new sessions until it is verified again.',
      confirmLabel: verified ? 'Mark verified' : 'Mark unverified',
      destructive: !verified,
    })
    if (ok) await setVerified(verified)
  }

  const act = async (project: AdminProject, next: 'grant' | 'revoke') => {
    const ok = await confirm({
      title: next === 'grant' ? 'Grant AI processing?' : 'Revoke AI processing?',
      description:
        next === 'grant'
          ? `Enable AI document processing for “${project.name}”.`
          : `Disable AI document processing for “${project.name}”. New sessions will fall back to the standard OCR driver.`,
      confirmLabel: next === 'grant' ? 'Grant' : 'Revoke',
      destructive: next === 'revoke',
    })
    if (!ok) return

    setBusyId(project.id)
    try {
      if (next === 'grant') await grant(project.id)
      else await revoke(project.id)
      const status: AccessGrantStatus = next === 'grant' ? 'granted' : 'revoked'
      update({
        data: projects.map((p) =>
          p.id === project.id
            ? { ...p, extended_access: { ...p.extended_access, ai: { ...p.extended_access.ai, status } } }
            : p,
        ),
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <Link
        to="/admin/organizations"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Organizations
      </Link>

      <PageHeader
        title={org.name}
        description={`${org.slug} · created ${formatDateTime(org.created_at)}${
          org.last_session_at ? ` · last session ${formatDateTime(org.last_session_at)}` : ''
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={VERIFICATION_STATUS[org.verification_status].variant}>
              {VERIFICATION_STATUS[org.verification_status].label}
            </Badge>
            {can('admin.organizations.manage') ? (
              <Button
                size="sm"
                variant="outline"
                disabled={settingVerified}
                onClick={() => void toggleVerified(org.verification_status !== 'verified')}
              >
                {org.verification_status === 'verified' ? 'Mark unverified' : 'Mark verified'}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Sessions"
          value={org.stats.total}
          icon={<ScrollText />}
          hint={`${org.stats.last_30_days} in 30 days`}
        />
        <StatCard
          label="Approval rate"
          value={`${Math.round(org.stats.approval_rate * 100)}%`}
          icon={<CheckCircle2 />}
          hint="of decided sessions"
        />
        <StatCard label="Awaiting review" value={org.stats.requires_review} icon={<Clock />} />
        <StatCard label="Last 7 days" value={org.stats.last_7_days} icon={<Gauge />} hint="new sessions" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sessions over time</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionTrendChart trend={org.stats.trend} height="h-48" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Footprint</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 text-sm">
            <Row label="Projects" value={`${org.counts.projects} (${org.counts.production_projects} production)`} />
            <Row label="Active members" value={org.counts.members} />
            <Row label="Active API keys" value={org.counts.api_keys} />
            <Row label="Active webhooks" value={org.counts.webhooks} />
            <p className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Risk signals, last 30 days
            </p>
            {org.stats.top_risk_signals.length ? (
              org.stats.top_risk_signals.map((signal) => (
                <Row key={signal.key} label={RISK_SIGNAL_LABEL[signal.key] ?? signal.key} value={signal.count} />
              ))
            ) : (
              <p className="text-muted-foreground">None open.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="px-2 pb-2">
          {error ? (
            <ErrorState error={error} />
          ) : projects.length === 0 && loading ? (
            <Loading />
          ) : projects.length === 0 ? (
            <EmptyState title="No projects" description="This organization has no projects yet." />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Project</TH>
                    <TH>Environment</TH>
                    <TH>AI processing</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {projects.map((project) => {
                    const status = project.extended_access.ai.status
                    const busy = busyId === project.id
                    return (
                      <TR key={project.id}>
                        <TD className="font-medium">
                          <Link to={`projects/${project.id}`} className="text-primary hover:underline">
                            {project.name}
                          </Link>
                        </TD>
                        <TD className="text-muted-foreground">{project.environment}</TD>
                        <TD>
                          <Badge variant={VARIANT[status]}>{status}</Badge>
                        </TD>
                        <TD className="text-right">
                          {canManage ? (
                            <div className="flex justify-end gap-2">
                              {status !== 'granted' ? (
                                <Button size="sm" disabled={busy} onClick={() => void act(project, 'grant')}>
                                  {busy ? '…' : 'Grant'}
                                </Button>
                              ) : null}
                              {status === 'granted' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void act(project, 'revoke')}
                                >
                                  {busy ? '…' : 'Revoke'}
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </TD>
                      </TR>
                    )
                  })}
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

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
