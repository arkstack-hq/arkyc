import { ACCESS_CAPABILITIES } from '@arkyc/types'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { ExtendedAccess, type AccessGrant, type AccessGrantStatus } from '@/lib/api'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { usePagination, useRequest } from 'alova/client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Pagination } from '@/components/Pagination'
import { Select } from '@/components/ui/select'
import { formatDateTime } from '@/lib/utils'
import { useAdmin } from '@/contexts/admin-context'
import { useConfirm } from '@/components/Confirm'
import { useState } from 'react'

const VARIANT: Record<AccessGrantStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  none: 'muted',
  pending: 'warning',
  granted: 'success',
  revoked: 'destructive',
}

export default function AdminExtendedAccessPage() {
  const { can } = useAdmin()
  const confirm = useConfirm()
  const canManage = can('admin.extended_access.manage')
  const [status, setStatus] = useState<'' | AccessGrantStatus>('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const {
    data: grants,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) => ExtendedAccess.list({ page: currentPage, limit: pageSize, status: status || undefined }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 20,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [status],
    },
  )

  const { send: grant } = useRequest((row: AccessGrant) => ExtendedAccess.grant(row.project_id, row.capability), {
    immediate: false,
  })
  const { send: revoke } = useRequest((row: AccessGrant) => ExtendedAccess.revoke(row.project_id, row.capability), {
    immediate: false,
  })

  const act = async (row: AccessGrant, next: 'grant' | 'revoke') => {
    const granting = next === 'grant'
    const capability = ACCESS_CAPABILITIES[row.capability]?.label ?? row.capability
    const name = row.project?.name ?? 'this project'
    const ok = await confirm({
      title: granting ? `Grant ${capability}?` : `Revoke ${capability}?`,
      description: granting ? `Enable ${capability} for “${name}”.` : `Disable ${capability} for “${name}”.`,
      confirmLabel: granting ? 'Grant' : row.status === 'pending' ? 'Deny' : 'Revoke',
      destructive: !granting,
    })
    if (!ok) return

    const key = row.id ?? `${row.project_id}:${row.capability}`
    setBusyId(key)
    try {
      if (granting) await grant(row)
      else await revoke(row)
      const nextStatus: AccessGrantStatus = granting ? 'granted' : 'revoked'
      update({
        data: grants.map((g) =>
          g.project_id === row.project_id && g.capability === row.capability ? { ...g, status: nextStatus } : g,
        ),
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Extended access" description="Requests and grants for gated project capabilities." />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3 border-b border-border">
          <Select
            className="w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | AccessGrantStatus)}
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
            <EmptyState title="Nothing here" description="No access records match this filter." />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Organization</TH>
                    <TH>Project</TH>
                    <TH>Capability</TH>
                    <TH>Status</TH>
                    <TH>Requested</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {grants.map((row) => {
                    const key = row.id ?? `${row.project_id}:${row.capability}`
                    const busy = busyId === key
                    return (
                      <TR key={key}>
                        <TD className="font-medium">{row.organization?.name ?? '—'}</TD>
                        <TD>{row.project?.name ?? '—'}</TD>
                        <TD>{ACCESS_CAPABILITIES[row.capability]?.label ?? row.capability}</TD>
                        <TD>
                          <Badge variant={VARIANT[row.status]}>{row.status}</Badge>
                        </TD>
                        <TD className="whitespace-nowrap text-muted-foreground">
                          {row.requested_at ? formatDateTime(row.requested_at) : '—'}
                        </TD>
                        <TD className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/admin/extended-access/${row.project_id}`}>Review</Link>
                            </Button>
                            {canManage && row.status !== 'granted' ? (
                              <Button size="sm" disabled={busy} onClick={() => void act(row, 'grant')}>
                                {busy ? '…' : row.status === 'pending' ? 'Approve' : 'Grant'}
                              </Button>
                            ) : null}
                            {canManage && row.status !== 'revoked' ? (
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
