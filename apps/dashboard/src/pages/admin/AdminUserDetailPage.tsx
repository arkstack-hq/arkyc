import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { ArrowLeft } from 'lucide-react'
import { Admin, type AdminUser, type UserStatus, errorMessage } from '@/lib/api'
import { useAdmin } from '@/contexts/admin-context'
import { useAuth } from '@/contexts/auth-context'
import { useConfirm } from '@/components/Confirm'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { formatDateTime } from '@/lib/utils'

const STATUS_VARIANT: Record<UserStatus, 'success' | 'warning' | 'destructive'> = {
  active: 'success',
  restricted: 'warning',
  suspended: 'destructive',
}

const STATUS_ACTIONS: { value: UserStatus; label: string; description: string; destructive?: boolean }[] = [
  { value: 'active', label: 'Active', description: 'Full access.' },
  { value: 'restricted', label: 'Restricted', description: 'Read-only: mutations are blocked.', destructive: true },
  { value: 'suspended', label: 'Suspended', description: 'Cannot sign in.', destructive: true },
]

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  )
}

export default function AdminUserDetailPage() {
  const { userId } = useParams()
  const { can } = useAdmin()
  const { user: currentUser } = useAuth()
  const confirm = useConfirm()
  const canManage = can('admin.users.manage')
  const isSelf = currentUser?.id === userId

  const { data: user, loading, error, send: reload } = useRequest(Admin.user(userId!), { immediate: !!userId })

  const { send: setStatus, loading: settingStatus } = useRequest(
    (status: UserStatus) => Admin.setUserStatus(userId!, status),
    {
      immediate: false,
    },
  )

  const [password, setPassword] = useState('')
  const {
    send: resetPassword,
    loading: resetting,
    error: resetError,
  } = useRequest(() => Admin.resetUserPassword(userId!, password), { immediate: false })

  if (loading && !user) return <Loading />
  if (error) return <ErrorState error={error} />
  if (!user) return null

  const current = user as AdminUser

  const changeStatus = async (status: UserStatus) => {
    const meta = STATUS_ACTIONS.find((s) => s.value === status)!
    const ok = await confirm({
      title: `Set status to ${meta.label}?`,
      description: `${meta.description} Applied to ${current.name || current.email}.`,
      confirmLabel: meta.label,
      destructive: meta.destructive,
    })
    if (!ok) return
    await setStatus(status)
    await reload()
  }

  const submitPassword = async () => {
    const ok = await confirm({
      title: 'Reset password?',
      description: `Set a new password for ${current.name || current.email}. They’ll need it to sign in.`,
      confirmLabel: 'Reset password',
    })
    if (!ok) return
    await resetPassword()
    setPassword('')
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6 mx-auto">
      <div>
        <Link
          to="/admin/users"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Users
        </Link>
        <PageHeader title={current.name || current.email} description={current.email} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <InfoRow label="Standing">
            <Badge variant={STATUS_VARIANT[current.status]}>{current.status}</Badge>
          </InfoRow>
          <InfoRow label="Platform admin">{current.is_admin ? <Badge>Admin</Badge> : '—'}</InfoRow>
          <InfoRow label="Email verified">
            {current.email_verified_at ? formatDateTime(current.email_verified_at) : 'No'}
          </InfoRow>
          <InfoRow label="Last login">
            {current.last_login_at ? formatDateTime(current.last_login_at) : 'Never'}
          </InfoRow>
          <InfoRow label="Created">{formatDateTime(current.created_at)}</InfoRow>
        </CardContent>
      </Card>

      {canManage ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Account standing</CardTitle>
              <CardDescription>
                Restrict a user to read-only access, or suspend them to block sign-in entirely.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {isSelf ? (
                <p className="text-sm text-muted-foreground">You cannot change your own account standing.</p>
              ) : (
                STATUS_ACTIONS.map((action) => (
                  <Button
                    key={action.value}
                    variant={current.status === action.value ? 'default' : 'outline'}
                    size="sm"
                    disabled={settingStatus || current.status === action.value}
                    onClick={() => void changeStatus(action.value)}
                  >
                    {action.label}
                  </Button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reset password</CardTitle>
              <CardDescription>Set a new password for this user.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </InputGroup>
                {resetError ? <FieldError>{errorMessage(resetError, 'Failed to reset password.')}</FieldError> : null}
              </Field>
              <div>
                <Button type="button" disabled={resetting || password.length < 8} onClick={() => void submitPassword()}>
                  {resetting ? <Spinner /> : null}
                  Reset password
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
