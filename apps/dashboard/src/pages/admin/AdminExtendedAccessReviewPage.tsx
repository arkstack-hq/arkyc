import { ACCESS_CAPABILITIES, type AccessCapability } from '@arkyc/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { ExtendedAccess, type AccessGrant, type AccessGrantStatus } from '@/lib/api'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link, useParams } from 'react-router-dom'
import { formatDateTime } from '@/lib/utils'
import { useAdmin } from '@/contexts/admin-context'
import { useConfirm } from '@/components/Confirm'
import { useRequest } from 'alova/client'
import { useState } from 'react'

const VARIANT: Record<AccessGrantStatus, 'success' | 'warning' | 'destructive' | 'muted'> = {
  none: 'muted',
  pending: 'warning',
  granted: 'success',
  revoked: 'destructive',
}

export default function AdminExtendedAccessReviewPage() {
  const { projectId } = useParams()
  const { can } = useAdmin()
  const confirm = useConfirm()
  const canManage = can('admin.extended_access.manage')
  const [busy, setBusy] = useState<AccessCapability | null>(null)

  const { data, loading, error, update } = useRequest(ExtendedAccess.project(projectId!), {
    immediate: !!projectId,
    initialData: { grants: [] as AccessGrant[], project: null },
  })

  const { send: grant } = useRequest((cap: AccessCapability) => ExtendedAccess.grant(projectId!, cap), {
    immediate: false,
  })
  const { send: revoke } = useRequest((cap: AccessCapability) => ExtendedAccess.revoke(projectId!, cap), {
    immediate: false,
  })

  const act = async (row: AccessGrant, next: 'grant' | 'revoke') => {
    const granting = next === 'grant'
    const label = ACCESS_CAPABILITIES[row.capability]?.label ?? row.capability
    const ok = await confirm({
      title: granting ? `Grant ${label}?` : `Revoke ${label}?`,
      description: granting
        ? `Enable ${label} for “${data.project?.name ?? 'this project'}”.`
        : `Disable ${label} for “${data.project?.name ?? 'this project'}”.`,
      confirmLabel: granting ? 'Grant' : row.status === 'pending' ? 'Deny' : 'Revoke',
      destructive: !granting,
    })
    if (!ok) return

    setBusy(row.capability)
    try {
      if (granting) await grant(row.capability)
      else await revoke(row.capability)
      const status: AccessGrantStatus = granting ? 'granted' : 'revoked'
      update({
        data: {
          ...data,
          grants: data.grants.map((g) => (g.capability === row.capability ? { ...g, status } : g)),
        },
      })
    } finally {
      setBusy(null)
    }
  }

  if (error) return <ErrorState error={error} />
  if (loading && data.grants.length === 0) return <Loading />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/extended-access" className="text-sm text-muted-foreground hover:text-foreground">
          ← All requests
        </Link>
        <PageHeader
          title={data.project?.name ?? 'Extended access'}
          description="Review the requested capabilities and grant or deny each independently."
        />
      </div>

      {data.grants.map((row) => {
        const meta = VARIANT[row.status]
        const label = ACCESS_CAPABILITIES[row.capability]?.label ?? row.capability

        return (
          <Card key={row.capability}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{label}</CardTitle>
                <Badge variant={meta}>{row.status}</Badge>
              </div>
              <CardDescription>
                {row.requested_at ? `Requested ${formatDateTime(row.requested_at)}` : 'Not requested yet'}
                {row.requester?.email ? ` by ${row.requester.email}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {row.capability === 'pii' && row.details ? (
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Data</dt>
                    <dd>{row.details.categories?.join(', ') || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Timing</dt>
                    <dd>{row.details.timing === 'before' ? 'Before verification' : 'After verification'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Justification</dt>
                    <dd className="whitespace-pre-wrap">{row.details.justification || '—'}</dd>
                  </div>
                </dl>
              ) : null}

              {canManage ? (
                <div className="flex gap-2">
                  {row.status !== 'granted' ? (
                    <Button size="sm" disabled={busy === row.capability} onClick={() => void act(row, 'grant')}>
                      {row.status === 'pending' ? 'Approve' : 'Grant'}
                    </Button>
                  ) : null}
                  {row.status !== 'revoked' && row.status !== 'none' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === row.capability}
                      onClick={() => void act(row, 'revoke')}
                    >
                      {row.status === 'pending' ? 'Deny' : 'Revoke'}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
