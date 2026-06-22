import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { Members, Roles, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
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

  const {
    data: member,
    loading,
    error,
    send: refreshMember,
  } = useRequest(Members.get(tenantId, memberId), { immediate: !!memberId })

  const { data: roles, loading: rolesLoading } = useRequest(Roles.options(tenantId), {
    immediate: can('settings.view') && can('members.update'),
    initialData: [],
  })

  const [roleId, setRoleId] = useState('')
  const [saved, setSaved] = useState(false)

  const {
    send: assignRole,
    loading: assigning,
    error: assignError,
    onSuccess: onAssignSuccess,
  } = useRequest((nextRoleId: string) => Members.assignRole(tenantId, memberId, { role_id: nextRoleId }), {
    immediate: false,
  })

  onAssignSuccess(() => {
    setSaved(true)
    void refreshMember()
  })

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} />
  if (!member) {
    return (
      <div className="p-6 lg:p-8">
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
                    onChange={(e) => {
                      setRoleId(e.target.value)
                      setSaved(false)
                    }}
                    disabled={rolesLoading}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    onClick={() => void assignRole(currentRoleId)}
                    disabled={assigning || currentRoleId === member.role_id}
                  >
                    {assigning ? 'Saving…' : 'Save'}
                  </Button>
                </div>
                {assignError ? (
                  <p className="text-sm text-destructive">{errorMessage(assignError, 'Failed to change role.')}</p>
                ) : null}
                {saved ? <p className="text-sm text-success">Role updated.</p> : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">You don't have permission to change this member's role.</p>
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
