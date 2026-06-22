import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm, useRequest } from 'alova/client'
import type { Permission, PermissionKey } from '@arkyc/types'
import type { RoleWithPermissions } from '@/lib/api'
import { Permissions, Roles, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { PageHeader, Loading, ErrorState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { humanize } from '@/lib/utils'

export default function RoleDetailPage() {
  const { roleId = '' } = useParams()
  const tenantId = useTenantId()

  const { data: role, loading: roleLoading, error: roleError } = useRequest(Roles.get(tenantId, roleId))

  const { data: catalogue, loading: catalogueLoading, error: catalogueError } = useRequest(Permissions.list(tenantId))

  if (roleLoading || catalogueLoading) return <Loading />
  if (roleError) return <ErrorState error={roleError} />
  if (catalogueError) return <ErrorState error={catalogueError} />
  if (!role) return <ErrorState error={new Error('Role not found.')} />

  return <RoleEditor role={role} catalogue={catalogue} tenantId={tenantId} roleId={roleId} />
}

function RoleEditor({
  role,
  catalogue,
  tenantId,
  roleId,
}: {
  role: RoleWithPermissions
  catalogue: Permission[]
  tenantId: string
  roleId: string
}) {
  const { can } = useTenant()
  const [saved, setSaved] = useState(false)

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData) =>
      Roles.update(tenantId, roleId, {
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions as PermissionKey[],
      }),
    {
      initialForm: {
        name: role.name,
        description: role.description ?? '',
        permissions: (role.permissions ?? []).map((p) => p.name),
      },
    },
  )

  onSuccess(() => setSaved(true))

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const perm of catalogue) {
      const list = map.get(perm.group) ?? []
      list.push(perm)
      map.set(perm.group, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [catalogue])

  const readOnly = role.is_system || !can('settings.update')
  const checked = new Set(form.permissions)

  function toggle(permName: PermissionKey) {
    const next = new Set(form.permissions)
    if (next.has(permName)) next.delete(permName)
    else next.add(permName)
    updateForm({ permissions: [...next] })
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
            <Field>
              <FieldLabel htmlFor="role-name">Name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="role-name"
                  value={form.name}
                  aria-invalid={!!error?.flat?.name}
                  onChange={(e) => {
                    updateForm({ name: e.target.value })
                    if (error?.errors) error.delete('name', update)
                  }}
                  disabled={readOnly}
                />
              </InputGroup>
              <FieldError errors={error?.list?.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="role-description">Description</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="role-description"
                  value={form.description}
                  aria-invalid={!!error?.flat?.description}
                  onChange={(e) => {
                    updateForm({ description: e.target.value })
                    if (error?.errors) error.delete('description', update)
                  }}
                  disabled={readOnly}
                />
              </InputGroup>
              <FieldError errors={error?.list?.description} />
            </Field>
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
                  {perms.map((perm) => {
                    // The tenant catalogue only contains tenant permissions.
                    const name = perm.name as PermissionKey

                    return (
                      <label key={name} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked.has(name)}
                          disabled={readOnly}
                          onChange={() => toggle(name)}
                        />
                        <span>
                          <span className="font-medium">{perm.name}</span>
                          {perm.description ? (
                            <span className="block text-xs text-muted-foreground">{perm.description}</span>
                          ) : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {!readOnly ? (
          <div className="flex items-center justify-end gap-3">
            {error && !error.errors ? <FieldError>{errorMessage(error, 'Failed to save.')}</FieldError> : null}
            {saved ? <p className="text-sm text-success">Role saved.</p> : null}
            <Button onClick={() => void send()} disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
