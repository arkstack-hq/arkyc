import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { BusinessVerifications, errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { useAdmin } from '@/contexts/admin-context'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { SubmissionSummary } from '@/pages/settings/BusinessVerificationPage'
import { REVIEW_STATUS } from './AdminBusinessVerificationsPage'

/** Review one business verification submission: its details, documents and decision. */
export default function AdminBusinessVerificationReviewPage() {
  const { id } = useParams()
  const { can } = useAdmin()
  const [note, setNote] = useState('')

  const {
    data: verification,
    loading,
    error,
    send: reload,
  } = useRequest(BusinessVerifications.adminGet(id!), {
    immediate: !!id,
  })
  const decision = useRequest(
    (approve: boolean) =>
      approve
        ? BusinessVerifications.approve(id!, note.trim() || undefined)
        : BusinessVerifications.reject(id!, note.trim()),
    { immediate: false },
  )
  decision.onSuccess(() => {
    setNote('')
    void reload()
  })

  if (error) return <ErrorState error={error} />
  if (loading || !verification) return <Loading />

  const status = REVIEW_STATUS[verification.status]

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-8">
      <PageHeader
        title={verification.organization?.name ?? 'Business verification'}
        description={`Submitted ${formatDateTime(verification.submitted_at)}`}
        actions={
          <Link to=".." relative="path" className="text-sm text-primary hover:underline">
            ← Business verification
          </Link>
        }
      />

      <SubmissionSummary
        verification={verification}
        title="Submitted details"
        open={(kind) => BusinessVerifications.adminDocument(verification.id, kind)}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Decision</CardTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <CardDescription>
            Check the registration against the company registry and that the documents match the details. Approving lets
            the organization run production projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {verification.status === 'pending' ? (
            can('admin.organizations.manage') ? (
              <>
                <Textarea
                  rows={3}
                  placeholder="Note to the organization. Required when rejecting: say what to fix."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled={decision.loading} onClick={() => void decision.send(true)}>
                    {decision.loading ? <Spinner /> : null}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={decision.loading || !note.trim()}
                    onClick={() => void decision.send(false)}
                  >
                    Reject
                  </Button>
                  {decision.error ? (
                    <FieldError>{errorMessage(decision.error, 'Failed to record the decision.')}</FieldError>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">You can view submissions but not decide them.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {status.label} {formatDateTime(verification.reviewed_at)}
              {verification.review_note ? `: ${verification.review_note}` : '.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
