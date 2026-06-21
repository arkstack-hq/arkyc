import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, usePagination } from 'alova/client'
import { Roles, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
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

  const [open, setOpen] = useState(false)

  const {
    data: roles,
    page,
    isLastPage,
    loading,
    error,
    update,
    reload: refreshRoles,
  } = usePagination(
    (currentPage, pageSize) => Roles.list(tenantId, { page: currentPage, limit: pageSize }),
    {
      append: true,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
    },
  )

  const {
    form,
    updateForm,
    send,
    loading: creating,
    error: createError,
    update: clearCreateError,
    onSuccess,
  } = useForm(
    (formData) =>
      Roles.create(tenantId, {
        name: formData.name,
        description: formData.description || undefined,
      }),
    { initialForm: { name: '', description: '' } },
  )

  onSuccess(() => {
    closeDialog()
    void refreshRoles()
  })

  function closeDialog() {
    setOpen(false)
    updateForm({ name: '', description: '' })
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

      {error ? (
        <ErrorState error={error} />
      ) : roles.length === 0 && loading ? (
        <Loading />
      ) : roles.length === 0 ? (
        <EmptyState title="No roles" description="Create a role to get started." />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Description</TH>
                <TH>Type</TH>
              </TR>
            </THead>
            <TBody>
              {roles.map((role) => (
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

          <InfiniteScroll
            onLoadMore={() => update({ page: page + 1 })}
            isLast={isLastPage}
            loading={loading}
          />
        </>
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
            void send()
          }}
        >
          <Field>
            <FieldLabel htmlFor="role-name">Name</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="role-name"
                required
                value={form.name}
                aria-invalid={!!createError?.flat?.name}
                onChange={(e) => {
                  updateForm({ name: e.target.value })
                  if (createError?.errors) createError.delete('name', clearCreateError)
                }}
                placeholder="Support agent"
              />
            </InputGroup>
            <FieldError errors={createError?.list?.name} />
          </Field>
          <Field>
            <FieldLabel htmlFor="role-description">Description</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="role-description"
                value={form.description}
                aria-invalid={!!createError?.flat?.description}
                onChange={(e) => {
                  updateForm({ description: e.target.value })
                  if (createError?.errors) createError.delete('description', clearCreateError)
                }}
                placeholder="What this role is for"
              />
            </InputGroup>
            <FieldError errors={createError?.list?.description} />
          </Field>

          {createError && !createError.errors ? (
            <FieldError>{errorMessage(createError, 'Failed to create role.')}</FieldError>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create role'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
