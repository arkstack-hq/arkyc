import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, usePagination, useRequest } from 'alova/client'
import { realtimeChannels } from '@arkyc/types'
import { Sessions } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { useRealtimeChannel } from '@/contexts/realtime-context'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { formatDateTime, humanize } from '@/lib/utils'

type Action = 'approve' | 'reject' | 'retry'

export default function ReviewsPage() {
  const tenantId = useTenantId()
  const { tenant, can } = useTenant()

  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  // Infinite-scroll list filtered to sessions awaiting review.
  const {
    data: sessions,
    loading,
    error,
    refresh,
    page,
    isLastPage,
    update,
  } = usePagination(
    (currentPage, pageSize) =>
      Sessions.list(tenantId, {
        page: currentPage,
        limit: pageSize,
        status: 'requires_review',
      }),
    {
      append: true,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
    },
  )

  // Reviewer row actions; the list cache auto-invalidates via hitSource, but the
  // mounted pagination needs an explicit refresh to reload the current page.
  const {
    send: sendAction,
    onSuccess: onActionSuccess,
    onError: onActionError,
  } = useRequest(
    (id: string, act: Action) => {
      if (act === 'approve') return Sessions.approve(tenantId, id)
      if (act === 'reject') return Sessions.reject(tenantId, id)
      return Sessions.requestRetry(tenantId, id)
    },
    { immediate: false },
  )

  onActionSuccess(() => {
    setActingId(null)
    void refresh(page)
  })
  onActionError(() => setActingId(null))

  // Live updates: any session transition or review action in this tenant reloads
  // the queue, so reviewers see new/cleared items without a manual refresh.
  useRealtimeChannel(realtimeChannels.tenant(tenantId), () => void refresh(page))

  const {
    form: noteForm,
    updateForm: updateNote,
    send: sendNote,
    loading: noteLoading,
    onSuccess: onNoteSuccess,
  } = useForm((form) => Sessions.note(tenantId, noteFor as string, { body: form.body.trim() }), {
    initialForm: { body: '' },
  })

  onNoteSuccess(() => {
    setNoteFor(null)
    void refresh(page)
  })

  const runAction = (id: string, act: Action) => {
    setActingId(id)
    void sendAction(id, act)
  }

  const sessionPath = (id: string) => (tenant ? `/t/${tenant.slug}/sessions/${id}` : `../sessions/${id}`)

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title="Review Queue" description="Sessions flagged for a manual decision." />

      <Card>
        <CardContent className="px-2 pb-2">
          {error ? (
            <ErrorState error={error} />
          ) : sessions.length === 0 && loading ? (
            <Loading />
          ) : sessions.length === 0 ? (
            <EmptyState title="No sessions awaiting review" />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>User reference</TH>
                    <TH>Reason</TH>
                    <TH>Risk</TH>
                    <TH>Created</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {sessions.map((s) => {
                    const pending = actingId === s.id
                    return (
                      <TR key={s.id}>
                        <TD>
                          <Link to={sessionPath(s.id)} className="text-primary hover:underline">
                            {s.user_reference ?? '—'}
                          </Link>
                        </TD>
                        <TD>{humanize(s.decision_reason)}</TD>
                        <TD>{s.risk_score?.toFixed(2) ?? '—'}</TD>
                        <TD className="text-muted-foreground">{formatDateTime(s.created_at)}</TD>
                        <TD>
                          <div className="flex items-center justify-end gap-2">
                            {pending ? <Spinner /> : null}
                            {can('reviews.approve') ? (
                              <Button
                                size="sm"
                                variant="default"
                                disabled={pending}
                                onClick={() => runAction(s.id, 'approve')}
                              >
                                Approve
                              </Button>
                            ) : null}
                            {can('reviews.reject') ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={pending}
                                onClick={() => runAction(s.id, 'reject')}
                              >
                                Reject
                              </Button>
                            ) : null}
                            {can('reviews.request_retry') ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => runAction(s.id, 'retry')}
                              >
                                Retry
                              </Button>
                            ) : null}
                            {can('reviews.note') ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => {
                                  setNoteFor(s.id)
                                  updateNote({ body: '' })
                                }}
                              >
                                Note
                              </Button>
                            ) : null}
                          </div>
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>

              <InfiniteScroll onLoadMore={() => update({ page: page + 1 })} isLast={isLastPage} loading={loading} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={noteFor !== null} onClose={() => setNoteFor(null)}>
        <DialogHeader>
          <DialogTitle>Add a note</DialogTitle>
          <DialogDescription>Attach an internal note to this session.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={noteForm.body}
          onChange={(e) => updateNote({ body: e.target.value })}
          placeholder="Write a note…"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setNoteFor(null)}>
            Cancel
          </Button>
          <Button
            disabled={!noteForm.body.trim() || noteLoading}
            onClick={() => {
              if (noteFor) void sendNote()
            }}
          >
            {noteLoading ? 'Saving…' : 'Save note'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
