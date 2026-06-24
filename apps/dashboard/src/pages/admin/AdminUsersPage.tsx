import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePagination, useRequest } from 'alova/client'
import { Admin, type AdminUser, type UserStatus } from '@/lib/api'
import { useAdmin } from '@/contexts/admin-context'
import { useConfirm } from '@/components/Confirm'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { ArrowDownRightFromSquareIcon, ShieldCloseIcon, ShieldUserIcon } from 'lucide-react'

const STATUS_VARIANT: Record<UserStatus, 'success' | 'warning' | 'destructive'> = {
  active: 'success',
  restricted: 'warning',
  suspended: 'destructive',
}

export default function AdminUsersPage() {
  const { can } = useAdmin()
  const confirm = useConfirm()
  const canManage = can('admin.users.manage')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const {
    data: users,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) => Admin.users({ page: currentPage, limit: pageSize, search: search || undefined }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 20,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [search],
    },
  )

  const { send: grant } = useRequest((id: string) => Admin.grantUserAdmin(id), { immediate: false })
  const { send: revoke } = useRequest((id: string) => Admin.revokeUserAdmin(id), { immediate: false })

  const toggleAdmin = async (user: AdminUser) => {
    const ok = await confirm({
      title: user.is_admin ? 'Revoke platform admin?' : 'Grant platform admin?',
      description: user.is_admin
        ? `Remove platform-admin access from ${user.name || user.email}.`
        : `Give ${user.name || user.email} full platform-admin access.`,
      confirmLabel: user.is_admin ? 'Revoke admin' : 'Make admin',
      destructive: user.is_admin,
    })
    if (!ok) return

    setBusyId(user.id)
    try {
      if (user.is_admin) await revoke(user.id)
      else await grant(user.id)
      update({ data: users.map((u) => (u.id === user.id ? { ...u, is_admin: !u.is_admin } : u)) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Users" description="Everyone with an Arkyc account." />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3 border-b border-border">
          <Input
            className="w-64"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </CardHeader>

        <CardContent className="px-2 pb-2">
          {error ? (
            <ErrorState error={error} />
          ) : users.length === 0 && loading ? (
            <Loading />
          ) : users.length === 0 ? (
            <EmptyState title="No users" description="No users match this search." />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Standing</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {users.map((user) => (
                    <TR key={user.id}>
                      <TD className="font-medium">
                        <Link to={`/admin/users/${user.id}`} className="hover:underline">
                          {user.name || '—'}
                        </Link>
                      </TD>
                      <TD className="text-muted-foreground">
                        {user.email}
                        {user.last_login_at ? (
                          <p className="whitespace-nowrap text-muted-foreground">
                            <small> Last seen {user.last_login_at ? formatDateTime(user.last_login_at) : '—'}</small>
                          </p>
                        ) : null}
                      </TD>
                      <TD>
                        <Badge variant={STATUS_VARIANT[user.status]}>{user.status}</Badge>
                      </TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/admin/users/${user.id}`}>
                              <ArrowDownRightFromSquareIcon />
                            </Link>
                          </Button>
                          {canManage ? (
                            <Button
                              variant={user.is_admin ? 'outline' : 'default'}
                              size="sm"
                              disabled={busyId === user.id}
                              onClick={() => void toggleAdmin(user)}
                            >
                              {busyId === user.id ? '…' : user.is_admin ? <ShieldCloseIcon /> : <ShieldUserIcon />}
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
