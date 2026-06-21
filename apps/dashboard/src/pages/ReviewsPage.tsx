import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { VerificationSession } from '@arkyc/types'
import { api } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { PageHeader, Loading, ErrorState, EmptyState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatDateTime, humanize } from '@/lib/utils'

type Action = 'approve' | 'reject' | 'retry'

export default function ReviewsPage() {
  const tenantId = useTenantId()
  const { tenant, can } = useTenant()
  const queryClient = useQueryClient()

  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteBody, setNoteBody] = useState('')

  const sessionsQuery = useQuery({
    queryKey: ['sessions', tenantId, { status: 'requires_review' }],
    queryFn: () => api.sessions.list(tenantId, { status: 'requires_review' }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sessions', tenantId] })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) => {
      if (action === 'approve') return api.sessions.approve(tenantId, id)
      if (action === 'reject') return api.sessions.reject(tenantId, id)
      return api.sessions.requestRetry(tenantId, id)
    },
    onSuccess: invalidate,
  })

  const noteMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.sessions.note(tenantId, id, { body }),
    onSuccess: () => {
      invalidate()
      setNoteFor(null)
      setNoteBody('')
    },
  })

  const sessionPending = (id: string) =>
    (actionMutation.isPending && actionMutation.variables?.id === id) ||
    (noteMutation.isPending && noteMutation.variables?.id === id)

  const sessions = (sessionsQuery.data ?? []) as VerificationSession[]
  const sessionPath = (id: string) =>
    tenant ? `/t/${tenant.slug}/sessions/${id}` : `../sessions/${id}`

  return (
    <div className="p-8">
      <PageHeader title="Review Queue" />

      {sessionsQuery.isLoading ? (
        <Loading />
      ) : sessionsQuery.isError ? (
        <ErrorState error={sessionsQuery.error} />
      ) : sessions.length === 0 ? (
        <EmptyState title="No sessions awaiting review" />
      ) : (
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
              const pending = sessionPending(s.id)
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
                          onClick={() => actionMutation.mutate({ id: s.id, action: 'approve' })}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {can('reviews.reject') ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => actionMutation.mutate({ id: s.id, action: 'reject' })}
                        >
                          Reject
                        </Button>
                      ) : null}
                      {can('reviews.request_retry') ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => actionMutation.mutate({ id: s.id, action: 'retry' })}
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
                            setNoteBody('')
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
      )}

      <Dialog open={noteFor !== null} onClose={() => setNoteFor(null)}>
        <DialogHeader>
          <DialogTitle>Add a note</DialogTitle>
          <DialogDescription>Attach an internal note to this session.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          placeholder="Write a note…"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setNoteFor(null)}>
            Cancel
          </Button>
          <Button
            disabled={!noteBody.trim() || noteMutation.isPending}
            onClick={() => {
              if (noteFor) noteMutation.mutate({ id: noteFor, body: noteBody.trim() })
            }}
          >
            {noteMutation.isPending ? 'Saving…' : 'Save note'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
