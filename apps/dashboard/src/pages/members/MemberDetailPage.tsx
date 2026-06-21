import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { humanize } from '@/lib/utils'

function statusVariant(status: string): 'success' | 'warning' | 'muted' {
  if (status === 'active') return 'success'
  if (status === 'invited') return 'warning'
  return 'muted'
}

export default function MemberDetailPage() {
  const { memberId = '' } = useParams()
  const tenantId = useTenantId()
  const { can } = useTenant()
  const queryClient = useQueryClient()

  const membersQuery = useQuery({
    queryKey: ['members', tenantId],
    queryFn: () => api.members.list(tenantId),
  })

  const rolesQuery = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => api.roles.list(tenantId),
    enabled: can('settings.view') && can('members.update'),
  })

  const member = membersQuery.data?.find((m) => m.id === memberId)

  const [roleId, setRoleId] = useState('')

  const assignRole = useMutation({
    mutationFn: (nextRoleId: string) =>
      api.members.assignRole(tenantId, memberId, { role_id: nextRoleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', tenantId] })
    },
  })

  if (membersQuery.isLoading) return <Loading />
  if (membersQuery.isError) return <ErrorState error={membersQuery.error} />
  if (!member) {
    return (
      <div>
        <PageHeader
          title="Member"
          actions={
            <Link to="../" className="text-sm text-primary hover:underline">
              ← Members
            </Link>
          }
        />
        <EmptyState title="Member not found" description="This member may have been removed." />
      </div>
    )
  }

  const currentRoleId = roleId || member.role_id

  return (
    <div>
      <PageHeader
        title={member.user?.name ?? member.user?.email ?? 'Member'}
        description={member.user?.email ?? undefined}
        actions={
          <Link to="../" className="text-sm text-primary hover:underline">
            ← Members
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Account and membership details.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{member.user?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{member.user?.email ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{member.role?.name ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={statusVariant(member.status)}>{humanize(member.status)}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>Manage this member's role and permissions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {can('members.update') ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="member-role">Change role</Label>
                <div className="flex gap-2">
                  <Select
                    id="member-role"
                    value={currentRoleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    disabled={rolesQuery.isLoading}
                  >
                    {(rolesQuery.data ?? []).map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    onClick={() => assignRole.mutate(currentRoleId)}
                    disabled={assignRole.isPending || currentRoleId === member.role_id}
                  >
                    {assignRole.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
                {assignRole.isError ? (
                  <p className="text-sm text-destructive">
                    {assignRole.error instanceof ApiError
                      ? assignRole.error.message
                      : 'Failed to change role.'}
                  </p>
                ) : null}
                {assignRole.isSuccess ? (
                  <p className="text-sm text-success">Role updated.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You don't have permission to change this member's role.
              </p>
            )}

            <Link to="permissions">
              <Button variant="outline" className="w-full">
                Manage permissions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
