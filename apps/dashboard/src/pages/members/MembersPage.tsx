import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, usePagination, useRequest } from 'alova/client'
import { Members, Roles, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatDateTime, humanize } from '@/lib/utils'

function statusVariant(status: string): 'success' | 'warning' | 'muted' {
  if (status === 'active') return 'success'
  if (status === 'invited') return 'warning'
  return 'muted'
}

export default function MembersPage() {
  const tenantId = useTenantId()
  const { can } = useTenant()

  const [open, setOpen] = useState(false)
  const [success, setSuccess] = useState(false)

  const canSeeRoles = can('settings.view')

  const {
    data: members,
    page,
    isLastPage,
    loading,
    error,
    update,
    reload: refreshMembers,
  } = usePagination(
    (currentPage, pageSize) => Members.list(tenantId, { page: currentPage, limit: pageSize }),
    {
      append: true,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
    },
  )

  const { data: roles, loading: rolesLoading } = useRequest(Roles.options(tenantId), {
    immediate: canSeeRoles && open,
    initialData: [],
  })

  const {
    form,
    updateForm,
    send: sendInvite,
    loading: inviting,
    error: inviteError,
    onSuccess,
  } = useForm((formData) => Members.invite(tenantId, formData), {
    initialForm: { email: '', role_id: '' },
  })

  onSuccess(() => {
    setSuccess(true)
    updateForm({ email: '', role_id: '' })
    void refreshMembers()
  })

  function closeDialog() {
    setOpen(false)
    setSuccess(false)
  }

  return (
    <div>
      <PageHeader
        title="Members"
        description="People with access to this organization."
        actions={
          can('members.invite') ? <Button onClick={() => setOpen(true)}>Invite</Button> : null
        }
      />

      {error ? (
        <ErrorState error={error} />
      ) : members.length === 0 && loading ? (
        <Loading />
      ) : members.length === 0 ? (
        <EmptyState title="No members yet" description="Invite teammates to collaborate." />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Joined</TH>
              </TR>
            </THead>
            <TBody>
              {members.map((member) => (
                <TR key={member.id}>
                  <TD>
                    <Link to={member.id} className="font-medium text-primary hover:underline">
                      {member.user?.name ?? '—'}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{member.user?.email ?? '—'}</TD>
                  <TD>{member.role?.name ?? '—'}</TD>
                  <TD>
                    <Badge variant={statusVariant(member.status)}>{humanize(member.status)}</Badge>
                  </TD>
                  <TD className="text-muted-foreground">
                    {formatDateTime(member.joined_at ?? member.created_at)}
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
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>Send an invitation to join this organization.</DialogDescription>
        </DialogHeader>

        {success ? (
          <>
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-success">Invitation sent.</p>
              <p className="mt-1 text-muted-foreground">
                The invitee will receive an email with a link to join.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={closeDialog}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void sendInvite()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => updateForm({ email: e.target.value })}
                placeholder="teammate@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              {canSeeRoles ? (
                <Select
                  id="invite-role"
                  required
                  value={form.role_id}
                  onChange={(e) => updateForm({ role_id: e.target.value })}
                >
                  <option value="" disabled>
                    {rolesLoading ? 'Loading roles…' : 'Select a role'}
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="invite-role"
                  required
                  value={form.role_id}
                  onChange={(e) => updateForm({ role_id: e.target.value })}
                  placeholder="Role ID"
                />
              )}
            </div>

            {inviteError ? (
              <p className="text-sm text-destructive">{errorMessage(inviteError, 'Failed to invite.')}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Sending…' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </div>
  )
}
