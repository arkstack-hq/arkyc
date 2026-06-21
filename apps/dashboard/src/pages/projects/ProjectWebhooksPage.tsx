import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, usePagination, useRequest } from 'alova/client'
import type { WebhookEventName } from '@arkyc/types'
import { Webhooks, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { formatDateTime, humanize } from '@/lib/utils'
import { Loading, ErrorState, EmptyState } from '@/components/States'
import { InfiniteScroll } from '@/components/InfiniteScroll'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const EVENT_NAMES: WebhookEventName[] = [
  'verification.started',
  'verification.document_submitted',
  'verification.processing',
  'verification.requires_review',
  'verification.approved',
  'verification.rejected',
  'verification.completed',
  'verification.expired',
  'verification.cancelled',
]

export default function ProjectWebhooksPage() {
  const tenantId = useTenantId()
  const { can } = useTenant()
  const { projectId } = useParams()

  const {
    data: webhooks,
    page,
    isLastPage,
    loading,
    error,
    update,
    reload: refreshWebhooks,
  } = usePagination(
    (currentPage, pageSize) =>
      Webhooks.list(tenantId, projectId!, { page: currentPage, limit: pageSize }),
    {
      append: true,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
    },
  )

  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    form,
    updateForm,
    send: createWebhook,
    loading: creating,
    error: createError,
    reset,
    onSuccess: onCreateSuccess,
  } = useForm((f) => Webhooks.create(tenantId, projectId!, { url: f.url.trim(), events: f.events }), {
    initialForm: { url: '', events: [] as WebhookEventName[] },
  })

  onCreateSuccess(({ data }) => {
    setSecret(data.secret)
    reset()
    void refreshWebhooks()
  })

  const { send: testWebhook, loading: testing } = useRequest(
    (webhookId: string) => Webhooks.test(tenantId, projectId!, webhookId),
    { immediate: false },
  )

  const {
    send: deleteWebhook,
    loading: deleting,
    onSuccess: onDeleteSuccess,
  } = useRequest((webhookId: string) => Webhooks.remove(tenantId, projectId!, webhookId), {
    immediate: false,
  })

  onDeleteSuccess(() => {
    void refreshWebhooks()
  })

  const closeDialog = () => {
    setOpen(false)
    setSecret(null)
    reset()
    setCopied(false)
  }

  const toggleEvent = (event: WebhookEventName) => {
    updateForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }))
  }

  const copySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {can('webhooks.create') ? (
          <Button onClick={() => setOpen(true)}>Add endpoint</Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : webhooks.length === 0 && loading ? (
        <Loading />
      ) : webhooks.length === 0 ? (
        <EmptyState
          title="No webhook endpoints"
          description="Add an endpoint to receive verification events."
        />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>URL</TH>
                <TH>Events</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {webhooks.map((webhook) => (
                <TR key={webhook.id}>
                  <TD className="font-mono text-xs">{webhook.url}</TD>
                  <TD className="text-xs text-muted-foreground">{webhook.events.join(', ')}</TD>
                  <TD>
                    <Badge variant={webhook.status === 'active' ? 'success' : 'muted'}>
                      {humanize(webhook.status)}
                    </Badge>
                  </TD>
                  <TD>{formatDateTime(webhook.created_at)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      {can('webhooks.test') ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={testing}
                          onClick={() => void testWebhook(webhook.id)}
                        >
                          Test
                        </Button>
                      ) : null}
                      {can('webhooks.delete') ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleting}
                          onClick={() => void deleteWebhook(webhook.id)}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <InfiniteScroll
            onLoadMore={() => update({ page: page + 1 })}
            isLast={isLastPage}
            loading={loading}
          />
        </>
      )}

      <Dialog open={open} onClose={closeDialog}>
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle>Endpoint created</DialogTitle>
              <DialogDescription>
                Copy this signing secret now — it will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-warning bg-warning/10 p-3">
              <code className="block break-all font-mono text-sm">{secret}</code>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={copySecret}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button type="button" onClick={closeDialog}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void createWebhook()
            }}
          >
            <DialogHeader>
              <DialogTitle>Add endpoint</DialogTitle>
              <DialogDescription>Choose which events to deliver to your URL.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={form.url}
                  onChange={(e) => updateForm({ url: e.target.value })}
                  placeholder="https://example.com/webhooks/arkyc"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Events</Label>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {EVENT_NAMES.map((event) => (
                    <label key={event} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="font-mono text-xs">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              {createError ? (
                <p className="text-sm text-destructive">
                  {errorMessage(createError, 'Failed to create endpoint.')}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !form.url.trim() || form.events.length === 0}
              >
                {creating ? <Spinner /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </div>
  )
}
