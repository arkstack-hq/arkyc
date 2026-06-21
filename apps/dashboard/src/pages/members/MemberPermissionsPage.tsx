import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import type { PermissionKey } from '@arkyc/types'
import { Members, Permissions, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { PageHeader, Loading, ErrorState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function MemberPermissionsPage() {
  const { memberId = '' } = useParams()
  const tenantId = useTenantId()
  const { can } = useTenant()

  const canUpdate = can('members.update')
  const [toAdd, setToAdd] = useState('')

  const {
    data: perms,
    loading,
    error,
    send: refreshPerms,
  } = useRequest(Members.permissions(tenantId, memberId))

  const { data: catalogue, loading: catalogueLoading } = useRequest(Permissions.list(tenantId), {
    immediate: canUpdate,
    initialData: [],
  })

  const {
    send: addPermission,
    loading: adding,
    error: addError,
    onSuccess: onAddSuccess,
  } = useRequest((permission: PermissionKey) => Members.addPermission(tenantId, memberId, { permission }), {
    immediate: false,
  })

  onAddSuccess(() => {
    setToAdd('')
    void refreshPerms()
  })

  const {
    send: removePermission,
    loading: removing,
    error: removeError,
    onSuccess: onRemoveSuccess,
  } = useRequest((permission: PermissionKey) => Members.removePermission(tenantId, memberId, permission), {
    immediate: false,
  })

  onRemoveSuccess(() => {
    void refreshPerms()
  })

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} />

  const directSet = new Set<string>(perms.direct_permissions)
  const available = catalogue.filter((p) => !directSet.has(p.name))

  return (
    <div>
      <PageHeader
        title="Member Permissions"
        description="Role-derived and directly-assigned permissions."
        actions={
          <Link to="../" className="text-sm text-primary hover:underline">
            ← Member
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Role permissions</CardTitle>
            <CardDescription>Granted through this member's role.</CardDescription>
          </CardHeader>
          <CardContent>
            {perms.role_permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {perms.role_permissions.map((p) => (
                  <Badge key={p} variant="muted">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Direct permissions</CardTitle>
            <CardDescription>Assigned directly to this member.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {perms.direct_permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {perms.direct_permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium"
                  >
                    {p}
                    {canUpdate ? (
                      <button
                        type="button"
                        aria-label={`Remove ${p}`}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                        disabled={removing}
                        onClick={() => void removePermission(p)}
                      >
                        ✕
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            )}

            {canUpdate ? (
              <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                <span className="text-sm font-medium">Add direct permission</span>
                <div className="flex gap-2">
                  <Select
                    value={toAdd}
                    onChange={(e) => setToAdd(e.target.value)}
                    disabled={catalogueLoading}
                  >
                    <option value="" disabled>
                      {catalogueLoading ? 'Loading…' : 'Select a permission'}
                    </option>
                    {available.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    disabled={!toAdd || adding}
                    onClick={() => void addPermission(toAdd as PermissionKey)}
                  >
                    {adding ? 'Adding…' : 'Add'}
                  </Button>
                </div>
                {addError || removeError ? (
                  <p className="text-sm text-destructive">
                    {errorMessage(addError ?? removeError, 'Failed to update permissions.')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Effective</CardTitle>
            <CardDescription>
              {perms.effective_permissions.length} effective permission
              {perms.effective_permissions.length === 1 ? '' : 's'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {perms.effective_permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {perms.effective_permissions.map((p) => (
                  <Badge key={p} variant="secondary">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
