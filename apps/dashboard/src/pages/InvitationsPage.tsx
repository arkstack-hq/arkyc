import { useNavigate } from 'react-router-dom'
import { usePagination, useRequest } from 'alova/client'
import { Invitations, errorMessage } from '@/lib/api'
import type { PendingInvitation } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { EmptyState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { formatDateTime } from '@/lib/utils'

export default function InvitationsPage() {
  const navigate = useNavigate()

  const {
    data: invitations,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination((currentPage, pageSize) => Invitations.pending({ page: currentPage, limit: pageSize }), {
    append: false,
    initialPage: 1,
    initialPageSize: 10,
    data: (res) => res.data,
    total: (res) => res.meta.total,
  })

  const {
    send: accept,
    loading: accepting,
    error: acceptError,
  } = useRequest((invitation: PendingInvitation) => Invitations.accept(invitation.id), { immediate: false })

  const join = async (invitation: PendingInvitation) => {
    await accept(invitation)
    if (invitation.organization) navigate(`/o/${invitation.organization.slug}/overview`)
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6 lg:p-8">
      <PageHeader title="Invitations" description="Organizations that invited you to join." />

      {loading ? (
        <Loading />
      ) : error ? (
        // A 403 here means the email is unverified; the API says so.
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">{errorMessage(error)}</CardContent>
        </Card>
      ) : invitations.length === 0 ? (
        <EmptyState title="No pending invitations" description="Invitations sent to your email will appear here." />
      ) : (
        <div className="flex flex-col gap-4">
          {invitations.map((invitation) => (
            <Card key={invitation.id}>
              <CardHeader>
                <CardTitle>{invitation.organization?.name ?? 'Organization'}</CardTitle>
                <CardDescription>
                  {invitation.role ? `Join as ${invitation.role.name}. ` : ''}Expires{' '}
                  {formatDateTime(invitation.expires_at)}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => void join(invitation)} disabled={accepting}>
                  Accept invitation
                </Button>
              </CardContent>
            </Card>
          ))}
          {acceptError ? <FieldError>{errorMessage(acceptError)}</FieldError> : null}
          <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
        </div>
      )}
    </div>
  )
}
