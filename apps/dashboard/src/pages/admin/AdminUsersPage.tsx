import { useState } from 'react'
import { usePagination, useRequest } from 'alova/client'
import { Admin, type AdminUser } from '@/lib/api'
import { useAdmin } from '@/contexts/admin-context'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'

export default function AdminUsersPage() {
  const { can } = useAdmin()
  const canManage = can('admin.users.manage')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const {
    data: users,
    page,
    isLastPage,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) => Admin.users({ page: currentPage, limit: pageSize, search: search || undefined }),
    {
      append: true,
      initialPage: 1,
      initialPageSize: 20,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [search],
    },
  )

  const { send: grant } = useRequest((id: string) => Admin.grantUserAdmin(id), { immediate: false })
  const { send: revoke } = useRequest((id: string) => Admin.revokeUserAdmin(id), {
    immediate: false,
  })

  const toggleAdmin = async (user: AdminUser) => {
    setBusyId(user.id)
    try {
      if (user.is_admin) await revoke(user.id)
      else await grant(user.id)
      // Optimistically flip the row; the list cache is invalidated by hitSource.
      update({ data: users.map((u) => (u.id === user.id ? { ...u, is_admin: !u.is_admin } : u)) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Users" description="Everyone with an Arkyc account." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="w-64"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
      </div>

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
                <TH>Last login</TH>
                <TH>Platform admin</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {users.map((user) => (
                <TR key={user.id}>
                  <TD className="font-medium">{user.name || '—'}</TD>
                  <TD className="text-muted-foreground">{user.email}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {user.last_login_at ? formatDateTime(user.last_login_at) : '—'}
                  </TD>
                  <TD>{user.is_admin ? <Badge>Admin</Badge> : <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-right">
                    {canManage ? (
                      <Button
                        variant={user.is_admin ? 'outline' : 'default'}
                        size="sm"
                        disabled={busyId === user.id}
                        onClick={() => void toggleAdmin(user)}
                      >
                        {busyId === user.id ? '…' : user.is_admin ? 'Revoke admin' : 'Make admin'}
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <InfiniteScroll onLoadMore={() => update({ page: page + 1 })} isLast={isLastPage} loading={loading} />
        </>
      )}
    </div>
  )
}
