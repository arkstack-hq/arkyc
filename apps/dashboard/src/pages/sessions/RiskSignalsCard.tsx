import { useState } from 'react'
import { useRequest } from 'alova/client'
import type { ScreeningHit, SessionRiskSignal } from '@arkyc/types'
import { Sessions } from '@/lib/api'
import { RISK_SEVERITY_VARIANT, RISK_SIGNAL_LABEL } from '@/lib/risk'
import { formatDateTime, humanize } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  organizationId: string
  sessionId: string
  signals: SessionRiskSignal[]
  /** Extracted identity, shown next to watchlist hits. */
  identity: Record<string, unknown> | null
  canClear: boolean
  onChanged: () => void
}

/** Fraud and compliance signals raised against a session, with the reviewer's clear action. */
export function RiskSignalsCard({ organizationId, sessionId, signals, identity, canClear, onChanged }: Props) {
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Risk signals</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {signals.map((signal) => (
          <SignalRow
            key={signal.id}
            organizationId={organizationId}
            sessionId={sessionId}
            signal={signal}
            identity={identity}
            canClear={canClear}
            onChanged={onChanged}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function SignalRow({
  organizationId,
  sessionId,
  signal,
  identity,
  canClear,
  onChanged,
}: Omit<Props, 'signals'> & {
  signal: SessionRiskSignal
}) {
  const [clearing, setClearing] = useState(false)
  const [reason, setReason] = useState('')
  const { send, loading, onSuccess } = useRequest(
    () => Sessions.clearSignal(organizationId, sessionId, signal.id, { reason: reason.trim() }),
    { immediate: false },
  )
  onSuccess(() => {
    setClearing(false)
    onChanged()
  })

  const hits = (signal.evidence.hits as ScreeningHit[] | undefined) ?? []
  const details = Object.entries(signal.evidence).filter(([key]) => key !== 'hits')

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{RISK_SIGNAL_LABEL[signal.key] ?? humanize(signal.key)}</span>
        {signal.cleared_at ? (
          <Badge variant="muted">Cleared</Badge>
        ) : (
          <Badge variant={RISK_SEVERITY_VARIANT[signal.severity]}>{humanize(signal.severity)}</Badge>
        )}
        {signal.advisory ? <Badge variant="outline">Advisory</Badge> : null}
        <span className="text-xs text-muted-foreground">
          {humanize(signal.source)} · {formatDateTime(signal.created_at)}
        </span>
        {canClear && !signal.cleared_at && !clearing ? (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setClearing(true)}>
            Clear
          </Button>
        ) : null}
      </div>

      {details.length ? (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {details.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{humanize(key)}</dt>
              <dd className="text-right font-medium">{evidenceText(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hits.length ? <ScreeningHits hits={hits} identity={identity} /> : null}

      {signal.cleared_at ? (
        <p className="text-xs text-muted-foreground">
          Cleared {formatDateTime(signal.cleared_at)}: {signal.clear_reason}
        </p>
      ) : null}

      {clearing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Textarea
            placeholder="Why is this a false positive? Recorded in the audit log."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            required
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={loading || !reason.trim()}>
              {loading ? <Spinner /> : null}
              Clear signal
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setClearing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

/** Watchlist hits side by side with the extracted identity. */
function ScreeningHits({ hits, identity }: { hits: ScreeningHit[]; identity: Record<string, unknown> | null }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-md bg-muted/40 p-3 text-sm">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Extracted identity</p>
        <p className="font-medium">{String(identity?.fullName ?? '—')}</p>
        <p className="text-muted-foreground">Born {String(identity?.dateOfBirth ?? '—')}</p>
        <p className="text-muted-foreground">Nationality {String(identity?.nationality ?? '—')}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {hits.map((hit) => (
          <li key={hit.entity_id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{hit.name}</span>
              <Badge variant="secondary">{(hit.score * 100).toFixed(0)}%</Badge>
            </div>
            <p className="text-muted-foreground">
              {humanize(hit.category)} · {hit.datasets.join(', ') || 'unknown list'}
            </p>
            {hit.birth_dates.length ? <p className="text-muted-foreground">Born {hit.birth_dates.join(', ')}</p> : null}
            {hit.countries.length ? (
              <p className="text-muted-foreground">Countries {hit.countries.join(', ').toUpperCase()}</p>
            ) : null}
            {hit.url ? (
              <a href={hit.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                View entity
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function evidenceText(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ') || '—'
  }
  if (typeof value === 'object') return JSON.stringify(value)

  return String(value)
}
