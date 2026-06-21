import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
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
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [success, setSuccess] = useState(false)

  const canSeeRoles = can('settings.view')

  const membersQuery = useQuery({
    queryKey: ['members', tenantId],
    queryFn: () => api.members.list(tenantId),
  })

  const rolesQuery = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api.roles.list(tenantId),
    enabled: canSeeRoles && open,
  })

  const invite = useMutation({
    mutationFn: () => api.members.invite(tenantId, { email, role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', tenantId] })
      setSuccess(true)
      setEmail('')
      setRoleId('')
    },
  })

  function closeDialog() {
    setOpen(false)
    setSuccess(false)
    invite.reset()
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

      {membersQuery.isLoading ? (
        <Loading />
      ) : membersQuery.isError ? (
        <ErrorState error={membersQuery.error} />
      ) : !membersQuery.data || membersQuery.data.length === 0 ? (
        <EmptyState title="No members yet" description="Invite teammates to collaborate." />
      ) : (
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
            {membersQuery.data.map((member) => (
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
              invite.mutate()
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              {canSeeRoles ? (
                <Select
                  id="invite-role"
                  required
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  <option value="" disabled>
                    {rolesQuery.isLoading ? 'Loading roles…' : 'Select a role'}
                  </option>
                  {(rolesQuery.data ?? []).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="invite-role"
                  required
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  placeholder="Role ID"
                />
              )}
            </div>

            {invite.isError ? (
              <p className="text-sm text-destructive">
                {invite.error instanceof ApiError ? invite.error.message : 'Failed to invite.'}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? 'Sending…' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </div>
  )
}
