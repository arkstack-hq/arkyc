import { useRequest } from 'alova/client'
import { ArrowLeft } from 'lucide-react'
import type { WebhookDelivery } from '@arkyc/types'
import { Webhooks } from '@/lib/api'
import { useOrganizationId } from '@/contexts/organization-context'
import { formatDateTime, humanize } from '@/lib/utils'
import { Loading, ErrorState } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const STATUS_VARIANT = { delivered: 'success', failed: 'destructive', pending: 'muted' } as const

/** Pretty-print a JSON string, or return it unchanged when it isn't JSON. */
function pretty(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function Code({ children }: { children: string }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap break-all">
      {children}
    </pre>
  )
}

/** One delivery: its outcome, the endpoint's response body and the payload that was sent. */
export function WebhookDeliveryDetail({
  projectId,
  endpointId,
  delivery,
  canResend,
  resending,
  onResend,
  onBack,
}: {
  projectId: string
  endpointId: string
  delivery: WebhookDelivery
  canResend: boolean
  resending: boolean
  onResend: () => void
  onBack: () => void
}) {
  const organizationId = useOrganizationId()

  const {
    data: detail,
    loading,
    error,
  } = useRequest(() => Webhooks.delivery(organizationId, projectId, endpointId, delivery.id))

  const facts: [string, string][] = [
    ['Event', delivery.event],
    ['Attempts', String(delivery.attempts)],
    ['Response', delivery.response_status ? `HTTP ${delivery.response_status}` : 'No response'],
    ['Session', delivery.session_id ?? '—'],
    ['Created', formatDateTime(delivery.created_at)],
    ['Last attempt', formatDateTime(delivery.updated_at)],
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft />
          All deliveries
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[delivery.status]}>{humanize(delivery.status)}</Badge>
          {canResend && delivery.status === 'failed' ? (
            <Button type="button" size="sm" variant="outline" disabled={resending} onClick={onResend}>
              {resending ? <Spinner /> : null}
              Resend
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 sm:block">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-all font-mono text-xs">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium">Response body</h3>
        <Code>{delivery.response_body ? pretty(delivery.response_body) : 'Empty'}</Code>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium">Payload sent</h3>
        {error ? (
          <ErrorState error={error} />
        ) : loading || !detail ? (
          <Loading />
        ) : (
          <Code>{JSON.stringify(detail.payload, null, 2)}</Code>
        )}
      </div>
    </div>
  )
}
