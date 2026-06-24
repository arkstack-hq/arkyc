import { useState } from 'react'
import { usePagination, useRequest } from 'alova/client'
import { AiAccess, type AiAccessGrant, type AiAccessStatus } from '@/lib/api'
import { useAdmin } from '@/contexts/admin-context'
import { useConfirm } from '@/components/Confirm'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'

const VARIANT: Record<AiAccessStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  none: 'muted',
  pending: 'warning',
  granted: 'success',
  revoked: 'destructive',
}

export default function AdminAiAccessPage() {
  const { can } = useAdmin()
  const confirm = useConfirm()
  const canManage = can('admin.ai_processing.manage')
  const [status, setStatus] = useState<'' | AiAccessStatus>('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const {
    data: grants,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) => AiAccess.list({ page: currentPage, limit: pageSize, status: status || undefined }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 20,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [status],
    },
  )

  const { send: grant } = useRequest((projectId: string) => AiAccess.grant(projectId), { immediate: false })
  const { send: revoke } = useRequest((projectId: string) => AiAccess.revoke(projectId), { immediate: false })

  const act = async (row: AiAccessGrant, next: 'grant' | 'revoke') => {
    const granting = next === 'grant'
    const name = row.project?.name ?? 'this project'
    const ok = await confirm({
      title: granting ? 'Grant AI processing?' : 'Revoke AI processing?',
      description: granting
        ? `Enable AI document processing for “${name}”.`
        : `Disable AI document processing for “${name}”. New sessions fall back to the standard OCR driver.`,
      confirmLabel: granting ? 'Grant' : row.status === 'pending' ? 'Deny' : 'Revoke',
      destructive: !granting,
    })
    if (!ok) return

    setBusyId(row.id ?? row.project_id)
    try {
      if (granting) await grant(row.project_id)
      else await revoke(row.project_id)
      const nextStatus: AiAccessStatus = granting ? 'granted' : 'revoked'
      update({ data: grants.map((g) => (g.project_id === row.project_id ? { ...g, status: nextStatus } : g)) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="AI access" description="Requests and grants for AI document processing." />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3 border-b border-border">
          <Select
            className="w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | AiAccessStatus)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="granted">Granted</option>
            <option value="revoked">Revoked</option>
          </Select>
        </CardHeader>

        <CardContent className="px-2 pb-2">
          {error ? (
            <ErrorState error={error} />
          ) : grants.length === 0 && loading ? (
            <Loading />
          ) : grants.length === 0 ? (
            <EmptyState title="Nothing here" description="No AI-access records match this filter." />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Organization</TH>
                    <TH>Project</TH>
                    <TH>Status</TH>
                    <TH>Requested</TH>
                    <TH>Requester</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {grants.map((row) => {
                    const busy = busyId === (row.id ?? row.project_id)
                    return (
                      <TR key={row.id ?? row.project_id}>
                        <TD className="font-medium">{row.organization?.name ?? '—'}</TD>
                        <TD>{row.project?.name ?? '—'}</TD>
                        <TD>
                          <Badge variant={VARIANT[row.status]}>{row.status}</Badge>
                        </TD>
                        <TD className="whitespace-nowrap text-muted-foreground">
                          {row.requested_at ? formatDateTime(row.requested_at) : '—'}
                        </TD>
                        <TD className="text-muted-foreground">{row.requester?.email ?? '—'}</TD>
                        <TD className="text-right">
                          {canManage ? (
                            <div className="flex justify-end gap-2">
                              {row.status !== 'granted' ? (
                                <Button size="sm" disabled={busy} onClick={() => void act(row, 'grant')}>
                                  {busy ? '…' : row.status === 'pending' ? 'Approve' : 'Grant'}
                                </Button>
                              ) : null}
                              {row.status !== 'revoked' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void act(row, 'revoke')}
                                >
                                  {busy ? '…' : row.status === 'pending' ? 'Deny' : 'Revoke'}
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
