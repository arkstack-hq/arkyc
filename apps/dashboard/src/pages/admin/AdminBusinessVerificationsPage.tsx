import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePagination } from 'alova/client'
import type { BusinessVerificationReviewStatus } from '@arkyc/types'
import { BusinessVerifications } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'

export const REVIEW_STATUS: Record<
  BusinessVerificationReviewStatus,
  { label: string; variant: 'warning' | 'success' | 'destructive' }
> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

/** Business verification submissions awaiting (or past) review. */
export default function AdminBusinessVerificationsPage() {
  const [status, setStatus] = useState<'' | BusinessVerificationReviewStatus>('pending')

  const {
    data: rows,
    page,
    pageCount,
    loading,
    error,
    update,
  } = usePagination(
    (currentPage, pageSize) =>
      BusinessVerifications.adminList({ page: currentPage, limit: pageSize, status: status || undefined }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 20,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [status],
    },
  )

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Business verification"
        description="Organizations proving they may handle personal data before going live."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-end">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | BusinessVerificationReviewStatus)}
            className="w-auto"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </Select>
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorState error={error} />
          ) : loading && rows.length === 0 ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState title="Nothing here" description="No submissions match this filter." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Organization</TH>
                  <TH>Legal name</TH>
                  <TH>Country</TH>
                  <TH>Submitted</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link to={row.id} className="font-medium text-primary hover:underline">
                        {row.organization?.name ?? row.organization_id}
                      </Link>
                    </TD>
                    <TD>{row.legal_name}</TD>
                    <TD>{row.country}</TD>
                    <TD>{formatDateTime(row.submitted_at)}</TD>
                    <TD>
                      <Badge variant={REVIEW_STATUS[row.status].variant}>{REVIEW_STATUS[row.status].label}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
          <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}
