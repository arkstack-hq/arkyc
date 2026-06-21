import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WebhookEndpoint, WebhookEventName } from '@arkyc/types'
import { api } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { formatDateTime, humanize } from '@/lib/utils'
import { Loading, ErrorState, EmptyState } from '@/components/States'
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
  const qc = useQueryClient()

  const webhooksQuery = useQuery({
    queryKey: ['webhooks', tenantId, projectId],
    queryFn: () => api.webhooks.list(tenantId, projectId!),
    enabled: !!projectId,
  })

  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventName[]>([])
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['webhooks', tenantId, projectId] })

  const createMutation = useMutation({
    mutationFn: () => api.webhooks.create(tenantId, projectId!, { url: url.trim(), events }),
    onSuccess: (result) => {
      invalidate()
      setSecret(result.secret)
      setUrl('')
      setEvents([])
    },
  })

  const testMutation = useMutation({
    mutationFn: (webhookId: string) => api.webhooks.test(tenantId, projectId!, webhookId),
  })

  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) => api.webhooks.remove(tenantId, projectId!, webhookId),
    onSuccess: invalidate,
  })

  const closeDialog = () => {
    setOpen(false)
    setSecret(null)
    setUrl('')
    setEvents([])
    setCopied(false)
    createMutation.reset()
  }

  const toggleEvent = (event: WebhookEventName) => {
    setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]))
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

  const webhooks: WebhookEndpoint[] = webhooksQuery.data ?? []

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {can('webhooks.create') ? (
          <Button onClick={() => setOpen(true)}>Add endpoint</Button>
        ) : null}
      </div>

      {webhooksQuery.isLoading ? (
        <Loading />
      ) : webhooksQuery.isError ? (
        <ErrorState error={webhooksQuery.error} />
      ) : webhooks.length === 0 ? (
        <EmptyState
          title="No webhook endpoints"
          description="Add an endpoint to receive verification events."
        />
      ) : (
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
                        disabled={testMutation.isPending}
                        onClick={() => testMutation.mutate(webhook.id)}
                      >
                        Test
                      </Button>
                    ) : null}
                    {can('webhooks.delete') ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(webhook.id)}
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
              createMutation.mutate()
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
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
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
                        checked={events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="font-mono text-xs">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              {createMutation.isError ? (
                <p className="text-sm text-destructive">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Failed to create endpoint.'}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !url.trim() || events.length === 0}
              >
                {createMutation.isPending ? <Spinner /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </div>
  )
}
