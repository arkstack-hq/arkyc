import { useState } from 'react'
import { usePagination, useRequest } from 'alova/client'
import { toast } from 'sonner'
import type { WebhookDelivery, WebhookDeliveryStatus, WebhookEndpoint } from '@arkyc/types'
import { Webhooks, errorMessage } from '@/lib/api'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'
import { useConfirm } from '@/components/Confirm'
import { formatDateTime, humanize } from '@/lib/utils'
import { Loading, ErrorState, EmptyState } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { WebhookDeliveryDetail } from './WebhookDeliveryDetail'

type StatusFilter = '' | WebhookDeliveryStatus

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'failed', label: 'Failed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'pending', label: 'Pending' },
  { value: '', label: 'All' },
]

const STATUS_VARIANT = { delivered: 'success', failed: 'destructive', pending: 'muted' } as const

/** An endpoint's delivery log, with resend actions for failed deliveries. */
export function WebhookDeliveriesDialog({
  projectId,
  endpoint,
  onClose,
}: {
  projectId: string
  endpoint: WebhookEndpoint
  onClose: () => void
}) {
  const organizationId = useOrganizationId()
  const { can } = useOrganization()
  const [status, setStatus] = useState<StatusFilter>('failed')
  const canResend = can('webhooks.update') && endpoint.status === 'active'

  const {
    data: deliveries,
    page,
    pageCount,
    loading,
    error,
    update,
    reload,
  } = usePagination(
    (currentPage, pageSize) =>
      Webhooks.deliveries(organizationId, projectId, endpoint.id, {
        page: currentPage,
        limit: pageSize,
        status: status || undefined,
      }),
    {
      append: false,
      initialPage: 1,
      initialPageSize: 10,
      data: (res) => res.data,
      total: (res) => res.meta.total,
      watchingStates: [status],
    },
  )

  const confirm = useConfirm()
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [inspecting, setInspecting] = useState<WebhookDelivery | null>(null)

  const { send: resend } = useRequest(
    (deliveryId: string) => Webhooks.resend(organizationId, projectId, endpoint.id, deliveryId),
    { immediate: false },
  )

  const { send: resendFailed, loading: resendingAll } = useRequest(
    () => Webhooks.resendFailed(organizationId, projectId, endpoint.id),
    { immediate: false },
  )

  const resendOne = async (deliveryId: string) => {
    setResendingId(deliveryId)
    try {
      const delivery = await resend(deliveryId)

      setInspecting((current) => (current?.id === delivery.id ? delivery : current))
      if (delivery.status === 'failed') toast.error('The endpoint rejected the delivery again.')
      else toast.success('Delivery resent')
      void reload()
    } catch (e) {
      toast.error(errorMessage(e, 'Failed to resend the delivery.'))
    } finally {
      setResendingId(null)
    }
  }

  const resendAll = async () => {
    const ok = await confirm({
      title: 'Resend all failed deliveries?',
      description: `Every failed delivery for this endpoint is sent to ${endpoint.url} again. Your handler may process those events twice if it is not idempotent.`,
      confirmLabel: 'Resend all',
      destructive: false,
    })
    if (!ok) return

    try {
      const queued = await resendFailed()

      toast.success(queued ? `Resending ${queued} failed deliveries` : 'No failed deliveries to resend')
      void reload()
    } catch (e) {
      toast.error(errorMessage(e, 'Failed to resend deliveries.'))
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Deliveries</DialogTitle>
        <DialogDescription className="break-all font-mono text-xs">{endpoint.url}</DialogDescription>
      </DialogHeader>

      {inspecting ? (
        <WebhookDeliveryDetail
          key={`${inspecting.id}:${inspecting.updated_at}`}
          projectId={projectId}
          endpointId={endpoint.id}
          delivery={inspecting}
          canResend={canResend}
          resending={resendingId === inspecting.id}
          onResend={() => void resendOne(inspecting.id)}
          onBack={() => setInspecting(null)}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl label="Filter by status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
            {canResend ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resendingAll}
                onClick={() => void resendAll()}
              >
                {resendingAll ? <Spinner /> : null}
                Resend all failed
              </Button>
            ) : null}
          </div>
          {can('webhooks.update') && endpoint.status !== 'active' ? (
            <p className="mb-3 text-sm text-muted-foreground">Enable this endpoint to resend its deliveries.</p>
          ) : null}

          {error ? (
            <ErrorState error={error} />
          ) : deliveries.length === 0 && loading ? (
            <Loading />
          ) : deliveries.length === 0 ? (
            <EmptyState title="No deliveries" description="Nothing matches this filter yet." />
          ) : (
            <>
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Event</TH>
                      <TH>Status</TH>
                      <TH>Response</TH>
                      <TH>Attempts</TH>
                      <TH>Created</TH>
                      {canResend ? <TH /> : null}
                    </TR>
                  </THead>
                  <TBody>
                    {deliveries.map((delivery) => (
                      <TR key={delivery.id}>
                        <TD>
                          <button
                            type="button"
                            className="text-left font-mono text-xs text-primary hover:underline"
                            onClick={() => setInspecting(delivery)}
                            aria-label={`Inspect ${delivery.event} delivery`}
                          >
                            {delivery.event}
                          </button>
                        </TD>
                        <TD>
                          <Badge variant={STATUS_VARIANT[delivery.status]}>{humanize(delivery.status)}</Badge>
                        </TD>
                        <TD>
                          <span className="text-xs" title={delivery.response_body ?? undefined}>
                            {delivery.response_status ? `HTTP ${delivery.response_status}` : '—'}
                          </span>
                        </TD>
                        <TD>{delivery.attempts}</TD>
                        <TD>{formatDateTime(delivery.created_at)}</TD>
                        {canResend ? (
                          <TD className="text-right">
                            {delivery.status === 'failed' ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                disabled={resendingId !== null}
                                onClick={() => void resendOne(delivery.id)}
                              >
                                {resendingId === delivery.id ? <Spinner /> : null}
                                Resend
                              </Button>
                            ) : null}
                          </TD>
                        ) : null}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>

              <Pagination page={page} pageCount={pageCount} onPage={(p) => update({ page: p })} loading={loading} />
            </>
          )}
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
