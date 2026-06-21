import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Permission, PermissionKey } from '@arkyc/types'
import { api, ApiError } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { humanize } from '@/lib/utils'

export default function RoleDetailPage() {
  const { roleId = '' } = useParams()
  const tenantId = useTenantId()
  const { can } = useTenant()
  const queryClient = useQueryClient()

  const roleQuery = useQuery({
    queryKey: ['role', tenantId, roleId],
    queryFn: () => api.roles.get(tenantId, roleId),
  })

  const catalogQuery = useQuery({
    queryKey: ['permissions', tenantId],
    queryFn: () => api.permissions.list(tenantId),
  })

  const role = roleQuery.data

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!role) return
    setName(role.name)
    setDescription(role.description ?? '')
    setChecked(new Set((role.permissions ?? []).map((p) => p.name)))
  }, [role])

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const perm of catalogQuery.data ?? []) {
      const list = map.get(perm.group) ?? []
      list.push(perm)
      map.set(perm.group, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [catalogQuery.data])

  const save = useMutation({
    mutationFn: () =>
      api.roles.update(tenantId, roleId, {
        name,
        description,
        permissions: [...checked] as PermissionKey[],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role', tenantId, roleId] })
      queryClient.invalidateQueries({ queryKey: ['roles', tenantId] })
    },
  })

  if (roleQuery.isLoading || catalogQuery.isLoading) return <Loading />
  if (roleQuery.isError) return <ErrorState error={roleQuery.error} />
  if (catalogQuery.isError) return <ErrorState error={catalogQuery.error} />
  if (!role) return <ErrorState error={new Error('Role not found.')} />

  const readOnly = role.is_system || !can('settings.update')

  function toggle(permName: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(permName)) next.delete(permName)
      else next.add(permName)
      return next
    })
  }

  return (
    <div>
      <PageHeader
        title={role.name}
        description={role.description ?? undefined}
        actions={
          <Link to="../" className="text-sm text-primary hover:underline">
            ← Roles
          </Link>
        }
      />

      {role.is_system ? (
        <p className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          This is a system role and cannot be edited.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {grouped.map(([group, perms]) => (
              <div key={group} className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">{humanize(group)}</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {perms.map((perm) => (
                    <label key={perm.name} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked.has(perm.name)}
                        disabled={readOnly}
                        onChange={() => toggle(perm.name)}
                      />
                      <span>
                        <span className="font-medium">{perm.name}</span>
                        {perm.description ? (
                          <span className="block text-xs text-muted-foreground">
                            {perm.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {!readOnly ? (
          <div className="flex items-center justify-end gap-3">
            {save.isError ? (
              <p className="text-sm text-destructive">
                {save.error instanceof ApiError ? save.error.message : 'Failed to save.'}
              </p>
            ) : null}
            {save.isSuccess ? <p className="text-sm text-success">Role saved.</p> : null}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
