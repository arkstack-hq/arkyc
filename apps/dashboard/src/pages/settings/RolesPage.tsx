import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function RolesPage() {
  const tenantId = useTenantId()
  const { can } = useTenant()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const rolesQuery = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api.roles.list(tenantId),
  })

  const create = useMutation({
    mutationFn: () => api.roles.create(tenantId, { name, description: description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', tenantId] })
      closeDialog()
    },
  })

  function closeDialog() {
    setOpen(false)
    setName('')
    setDescription('')
    create.reset()
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Define roles and their permissions."
        actions={
          <div className="flex items-center gap-2">
            <Link to="../" className="text-sm text-primary hover:underline">
              ← Settings
            </Link>
            {can('settings.update') ? (
              <Button onClick={() => setOpen(true)}>New role</Button>
            ) : null}
          </div>
        }
      />

      {rolesQuery.isLoading ? (
        <Loading />
      ) : rolesQuery.isError ? (
        <ErrorState error={rolesQuery.error} />
      ) : !rolesQuery.data || rolesQuery.data.length === 0 ? (
        <EmptyState title="No roles" description="Create a role to get started." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Description</TH>
              <TH>Type</TH>
            </TR>
          </THead>
          <TBody>
            {rolesQuery.data.map((role) => (
              <TR key={role.id}>
                <TD>
                  <Link to={role.id} className="font-medium text-primary hover:underline">
                    {role.name}
                  </Link>
                </TD>
                <TD className="text-muted-foreground">{role.description ?? '—'}</TD>
                <TD>
                  {role.is_system ? (
                    <Badge variant="muted">System</Badge>
                  ) : (
                    <Badge variant="secondary">Custom</Badge>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={open} onClose={closeDialog}>
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>Create a custom role for this organization.</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Support agent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role is for"
            />
          </div>

          {create.isError ? (
            <p className="text-sm text-destructive">
              {create.error instanceof ApiError ? create.error.message : 'Failed to create role.'}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create role'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
