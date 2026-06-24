import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePagination, useRequest } from 'alova/client'
import { ArrowLeft } from 'lucide-react'
import { AiAccess, type AdminProject, type AiAccessStatus } from '@/lib/api'
import { useAdmin } from '@/contexts/admin-context'
import { useConfirm } from '@/components/Confirm'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

const VARIANT: Record<AiAccessStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  none: 'muted',
  pending: 'warning',
  granted: 'success',
  revoked: 'destructive',
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

export default function AdminOrganizationDetailPage() {
  const { organizationId } = useParams()
  const { can } = useAdmin()
  const confirm = useConfirm()
  const canManage = can('admin.ai_processing.manage')
  const [busyId, setBusyId] = useState<string | null>(null)

  const {
    data: org,
    loading: orgLoading,
    error: orgError,
  } = useRequest(AiAccess.organization(organizationId!), {
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
    (currentPage, pageSize) => AiAccess.organizationProjects(organizationId!, { page: currentPage, limit: pageSize }),
    { append: false, initialPage: 1, initialPageSize: 15, data: (res) => res.data, total: (res) => res.meta.total },
  )

  const { send: grant } = useRequest((projectId: string) => AiAccess.grant(projectId), { immediate: false })
  const { send: revoke } = useRequest((projectId: string) => AiAccess.revoke(projectId), { immediate: false })

  if (orgLoading && !org) return <Loading />
  if (orgError) return <ErrorState error={orgError} />
  if (!org) return null

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
      const status: AiAccessStatus = next === 'grant' ? 'granted' : 'revoked'
      update({ data: projects.map((p) => (p.id === project.id ? { ...p, ai_access: { ...p.ai_access, status } } : p)) })
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

      <PageHeader title={org.name} description={org.slug} />

      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Projects" value={org.counts.projects} />
        <Stat label="Members" value={org.counts.members} />
        <Stat label="Sessions" value={org.counts.sessions} />
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
                    const status = project.ai_access.status
                    const busy = busyId === project.id
                    return (
                      <TR key={project.id}>
                        <TD className="font-medium">{project.name}</TD>
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
