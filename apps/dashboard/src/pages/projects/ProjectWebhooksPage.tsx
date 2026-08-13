import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, usePagination, useRequest } from 'alova/client'
import type { WebhookEndpoint, WebhookEndpointStatus, WebhookEventName } from '@arkyc/types'
import { Webhooks, errorMessage } from '@/lib/api'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'
import { formatDateTime, humanize } from '@/lib/utils'
import { Loading, ErrorState, EmptyState } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { useConfirm } from '@/components/Confirm'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

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
  const organizationId = useOrganizationId()
  const { can } = useOrganization()
  const { projectId } = useParams()

  const {
    data: webhooks,
    page,
    pageCount,
    loading,
    error,
    update,
    reload: refreshWebhooks,
  } = usePagination(
    (currentPage, pageSize) => Webhooks.list(organizationId, projectId!, { page: currentPage, limit: pageSize }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 15,
      data: (res) => res.data,
      total: (res) => res.meta.total,
    },
  )

  const [open, setOpen] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    form,
    updateForm,
    send: createWebhook,
    loading: creating,
    error: createError,
    update: clearCreateError,
    reset,
    onSuccess: onCreateSuccess,
  } = useForm(
    (f) =>
      Webhooks.create(organizationId, projectId!, {
        url: f.url.trim(),
        events: f.events,
      }),
    {
      initialForm: { url: '', events: [] as WebhookEventName[] },
    },
  )

  onCreateSuccess(({ data }) => {
    setSecret(data.secret)
    reset()
    void refreshWebhooks()
  })

  const { send: testWebhook, loading: testing } = useRequest(
    (webhookId: string) => Webhooks.test(organizationId, projectId!, webhookId),
    { immediate: false },
  )

  const {
    form: editForm,
    updateForm: updateEditForm,
    send: updateWebhook,
    loading: saving,
    error: updateError,
    update: clearUpdateError,
    onSuccess: onUpdateSuccess,
  } = useForm(
    (f) =>
      Webhooks.update(organizationId, projectId!, selectedWebhook!.id, {
        url: f.url.trim(),
        events: f.events,
        status: f.status,
      }),
    { initialForm: { url: '', events: [] as WebhookEventName[], status: 'active' as WebhookEndpointStatus } },
  )

  onUpdateSuccess(() => {
    setSelectedWebhook(null)
    void refreshWebhooks()
  })

  const confirm = useConfirm()
  const {
    send: deleteWebhook,
    loading: deleting,
    onSuccess: onDeleteSuccess,
  } = useRequest((webhookId: string) => Webhooks.remove(organizationId, projectId!, webhookId), {
    immediate: false,
  })

  onDeleteSuccess(() => {
    setSelectedWebhook(null)
    void refreshWebhooks()
  })

  const confirmDeleteWebhook = async (webhookId: string) => {
    const ok = await confirm({
      title: 'Delete webhook endpoint?',
      description: 'Arkyc will stop delivering events to this endpoint.',
      confirmLabel: 'Delete',
    })
    if (ok) await deleteWebhook(webhookId)
  }

  const closeDialog = () => {
    setOpen(false)
    setSecret(null)
    reset()
    setCopied(false)
  }

  const openManagementDialog = (webhook: WebhookEndpoint) => {
    setSelectedWebhook(webhook)
    updateEditForm({ url: webhook.url, events: webhook.events, status: webhook.status })
    clearUpdateError({ error: undefined })
  }

  const closeManagementDialog = () => {
    if (saving || deleting) return
    setSelectedWebhook(null)
  }

  const toggleEvent = (event: WebhookEventName) => {
    // alova's `updateForm` only merges a partial object — its function-updater
    // overload is typed but not implemented (it spreads the function, a no-op).
    // Compute from the current reactive `form.events` and pass a partial.
    updateForm({
      events: form.events.includes(event) ? form.events.filter((e) => e !== event) : [...form.events, event],
    })
  }

  const toggleEditEvent = (event: WebhookEventName) => {
    updateEditForm({
      events: editForm.events.includes(event)
        ? editForm.events.filter((item) => item !== event)
        : [...editForm.events, event],
    })
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
        {can('webhooks.create') ? <Button onClick={() => setOpen(true)}>Add endpoint</Button> : null}
      </div>

      <Card>
        <CardContent className="px-2 pb-2">
          {error ? (
            <ErrorState error={error} />
          ) : webhooks.length === 0 && loading ? (
            <Loading />
          ) : webhooks.length === 0 ? (
            <EmptyState title="No webhook endpoints" description="Add an endpoint to receive verification events." />
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>URL</TH>
                    <TH>Status</TH>
                    <TH>Created</TH>
                  </TR>
                </THead>
                <TBody>
                  {webhooks.map((webhook) => (
                    <TR key={webhook.id}>
                      <TD>
                        <button
                          type="button"
                          className="break-all text-left font-mono text-xs text-primary hover:underline"
                          onClick={() => openManagementDialog(webhook)}
                          aria-label={`Manage webhook ${webhook.url}`}
                        >
                          {webhook.url}
                        </button>
                      </TD>
                      <TD>
                        <Badge variant={webhook.status === 'active' ? 'success' : 'muted'}>
                          {humanize(webhook.status)}
                        </Badge>
                      </TD>
                      <TD>{formatDateTime(webhook.created_at)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedWebhook} onClose={closeManagementDialog}>
        {selectedWebhook ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void updateWebhook()
            }}
          >
            <DialogHeader>
              <DialogTitle>Manage endpoint</DialogTitle>
              <DialogDescription>Edit where and when webhook events are delivered.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="edit-webhook-url">Endpoint URL</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <Globe />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="edit-webhook-url"
                    type="url"
                    value={editForm.url}
                    aria-invalid={!!updateError?.flat?.url}
                    disabled={!can('webhooks.update')}
                    onChange={(e) => {
                      updateEditForm({ url: e.target.value })
                      if (updateError?.errors) updateError.delete('url', clearUpdateError)
                    }}
                    required
                  />
                </InputGroup>
                <FieldError errors={updateError?.list?.url} />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-webhook-status">Status</FieldLabel>
                <Select
                  id="edit-webhook-status"
                  value={editForm.status}
                  onChange={(e) => updateEditForm({ status: e.target.value as WebhookEndpointStatus })}
                  disabled={!can('webhooks.update')}
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </Field>
              <div className="flex flex-col gap-2">
                <Label>Events</Label>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {EVENT_NAMES.map((event) => (
                    <label key={event} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.events.includes(event)}
                        onChange={() => toggleEditEvent(event)}
                        className="h-4 w-4 rounded border-input"
                        disabled={!can('webhooks.update')}
                      />
                      <span className="font-mono text-xs">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              {updateError && !updateError.errors ? (
                <FieldError>{errorMessage(updateError, 'Failed to update endpoint.')}</FieldError>
              ) : null}
            </div>
            <DialogFooter className="flex-wrap justify-between sm:flex-nowrap">
              <div className="flex gap-2">
                {can('webhooks.delete') ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleting || saving}
                    onClick={() => void confirmDeleteWebhook(selectedWebhook.id)}
                  >
                    Delete
                  </Button>
                ) : null}
                {can('webhooks.test') ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testing || saving}
                    onClick={() => void testWebhook(selectedWebhook.id)}
                  >
                    {testing ? <Spinner /> : null}
                    Test
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={closeManagementDialog}>
                  Close
                </Button>
                {can('webhooks.update') ? (
                  <Button type="submit" disabled={saving || !editForm.url.trim() || editForm.events.length === 0}>
                    {saving ? <Spinner /> : null}
                    Save changes
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </form>
        ) : null}
      </Dialog>

      <Dialog open={open} onClose={closeDialog}>
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle>Endpoint created</DialogTitle>
              <DialogDescription>Copy this signing secret now — it will not be shown again.</DialogDescription>
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
              <Field>
                <FieldLabel htmlFor="webhook-url">Endpoint URL</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <Globe />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="webhook-url"
                    type="url"
                    value={form.url}
                    aria-invalid={!!createError?.flat?.url}
                    onChange={(e) => {
                      updateForm({ url: e.target.value })
                      if (createError?.errors) createError.delete('url', clearCreateError)
                    }}
                    placeholder="https://example.com/webhooks/arkyc"
                    required
                  />
                </InputGroup>
                <FieldError errors={createError?.list?.url} />
              </Field>
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
              {createError && !createError.errors ? (
                <FieldError>{errorMessage(createError, 'Failed to create endpoint.')}</FieldError>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !form.url.trim() || form.events.length === 0}>
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
