import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PermissionKey } from '@arkyc/types'
import { api, ApiError } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function MemberPermissionsPage() {
  const { memberId = '' } = useParams()
  const tenantId = useTenantId()
  const { can } = useTenant()
  const queryClient = useQueryClient()

  const canUpdate = can('members.update')
  const [toAdd, setToAdd] = useState('')

  const permsQuery = useQuery({
    queryKey: ['member-permissions', tenantId, memberId],
    queryFn: () => api.members.permissions(tenantId, memberId),
  })

  const catalogQuery = useQuery({
    queryKey: ['permissions', tenantId],
    queryFn: () => api.permissions.list(tenantId),
    enabled: canUpdate,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['member-permissions', tenantId, memberId] })

  const addPermission = useMutation({
    mutationFn: (permission: PermissionKey) =>
      api.members.addPermission(tenantId, memberId, { permission }),
    onSuccess: () => {
      setToAdd('')
      invalidate()
    },
  })

  const removePermission = useMutation({
    mutationFn: (permission: PermissionKey) =>
      api.members.removePermission(tenantId, memberId, permission),
    onSuccess: invalidate,
  })

  if (permsQuery.isLoading) return <Loading />
  if (permsQuery.isError) return <ErrorState error={permsQuery.error} />

  const perms = permsQuery.data!
  const directSet = new Set<string>(perms.direct_permissions)
  const available = (catalogQuery.data ?? []).filter((p) => !directSet.has(p.name))

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
                        disabled={removePermission.isPending}
                        onClick={() => removePermission.mutate(p)}
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
                    disabled={catalogQuery.isLoading}
                  >
                    <option value="" disabled>
                      {catalogQuery.isLoading ? 'Loading…' : 'Select a permission'}
                    </option>
                    {available.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    disabled={!toAdd || addPermission.isPending}
                    onClick={() => addPermission.mutate(toAdd as PermissionKey)}
                  >
                    {addPermission.isPending ? 'Adding…' : 'Add'}
                  </Button>
                </div>
                {addPermission.isError || removePermission.isError ? (
                  <p className="text-sm text-destructive">
                    {(addPermission.error ?? removePermission.error) instanceof ApiError
                      ? (addPermission.error ?? (removePermission.error as ApiError)).message
                      : 'Failed to update permissions.'}
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
