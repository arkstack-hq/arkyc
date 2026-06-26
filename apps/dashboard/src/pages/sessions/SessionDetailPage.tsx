import { type ReactNode, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { realtimeChannels, type VerificationDecision, type VerificationStatus } from '@arkyc/types'
import { Sessions, fetchSessionMedia } from '@/lib/api'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'
import { useRealtimeChannel } from '@/contexts/realtime-context'
import { PageHeader, Loading, ErrorState } from '@/components/States'
import { useConfirm } from '@/components/Confirm'
import { MediaLightbox, type MediaItem } from '@/components/MediaLightbox'
import { Play } from 'lucide-react'
import { StatusBadge, DecisionBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatDateTime, humanize } from '@/lib/utils'

/** The dashboard session-detail payload (base session + checks + media). */
interface SessionDetail {
  id: string
  project_id: string
  user_reference?: string | null
  status: VerificationStatus
  auto_decision?: VerificationDecision | null
  final_decision?: VerificationDecision | null
  decision_reason?: string | null
  risk_score?: number | null
  reviewed_at?: string | null
  completed_at?: string | null
  created_at: string
  expires_at: string
  ocr?: { fields?: Record<string, unknown> | null; confidence?: number | null } | null
  document?: { country?: string | null; document_type?: string | null; quality_score?: number | null } | null
  liveness?: { score?: number | null; passed?: boolean | null; spoof_signals?: Record<string, unknown> | null } | null
  face_match?: { similarity_score?: number | null; confidence?: number | null; passed?: boolean | null } | null
  address?: {
    passed?: boolean | null
    score?: number | null
    claimed_address?: Record<string, unknown> | null
    methods?: { method: string; passed: boolean; confidence: number; note?: string }[] | null
  } | null
  media?: string[]
}

const IMAGE_KINDS = ['document_front', 'document_back', 'portrait', 'selfie'] as const

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

const num = (v: number | null | undefined, digits = 2) => (typeof v === 'number' ? v.toFixed(digits) : '—')
const bool = (v: boolean | null | undefined) => (v == null ? '—' : v ? 'Passed' : 'Failed')

/** Loads a private media artifact through the authenticated route as an object URL. */
function SessionMedia({
  organizationId,
  sessionId,
  kind,
  onOpen,
}: {
  organizationId: string
  sessionId: string
  kind: string
  /** Open the media in the lightbox (makes the thumbnail clickable). */
  onOpen?: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let made: string | null = null
    setUrl(null)
    setFailed(false)
    fetchSessionMedia(organizationId, sessionId, kind)
      .then((u) => {
        if (active) {
          made = u
          setUrl(u)
        } else URL.revokeObjectURL(u)
      })
      .catch(() => active && setFailed(true))
    return () => {
      active = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [organizationId, sessionId, kind])

  const interactive = !!onOpen && !failed && !!url

  return (
    <figure className="flex flex-col gap-1.5">
      <div
        className={
          'relative flex aspect-3/2 items-center justify-center overflow-hidden rounded-md border border-border bg-muted' +
          (interactive ? ' cursor-pointer transition-shadow hover:ring-2 hover:ring-primary' : '')
        }
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? onOpen : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen?.()
                }
              }
            : undefined
        }
      >
        {failed ? (
          <span className="text-xs text-muted-foreground">Unavailable</span>
        ) : !url ? (
          <Spinner />
        ) : kind === 'video' ? (
          // In a clickable grid the thumbnail opens the lightbox (which plays it
          // with controls); without `onOpen` it stays inline-playable.
          <video
            src={url}
            controls={!onOpen}
            muted
            className="h-full w-full object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <img src={url} alt={kind} className="h-full w-full object-contain" onError={() => setFailed(true)} />
        )}
        {interactive && kind === 'video' ? (
          <span className="pointer-events-none absolute flex size-11 items-center justify-center rounded-full bg-black/50 text-white">
            <Play className="size-5" />
          </span>
        ) : null}
      </div>
      <figcaption className="text-xs text-muted-foreground">{humanize(kind)}</figcaption>
    </figure>
  )
}

export default function SessionDetailPage() {
  const organizationId = useOrganizationId()
  const { can } = useOrganization()
  const confirm = useConfirm()
  const { sessionId } = useParams()
  const [reason, setReason] = useState('')
  const [retryKind, setRetryKind] = useState<'document' | 'selfie' | 'full'>('full')
  const [lightbox, setLightbox] = useState<number | null>(null)

  const {
    data: raw,
    loading,
    error,
    send,
  } = useRequest(Sessions.get(organizationId, sessionId as string), {
    immediate: !!sessionId,
  })
  const data = raw as unknown as SessionDetail | undefined

  // Live updates: refetch when this session transitions or is acted on.
  useRealtimeChannel(sessionId ? realtimeChannels.session(sessionId) : null, () => void send())

  // Reviewer override actions; refetch the detail on success.
  const {
    send: act,
    loading: acting,
    onSuccess: onActed,
  } = useRequest(
    (action: 'approve' | 'reject' | 'retry') => {
      const id = sessionId as string
      const reasonInput = reason.trim() ? { reason: reason.trim() } : {}
      if (action === 'approve') return Sessions.approve(organizationId, id, reasonInput)
      if (action === 'reject') return Sessions.reject(organizationId, id, reasonInput)
      return Sessions.requestRetry(organizationId, id, { kind: retryKind, ...reasonInput })
    },
    { immediate: false },
  )
  onActed(() => {
    setReason('')
    void send()
  })

  const rejectWithConfirm = async () => {
    const ok = await confirm({
      title: 'Reject verification?',
      description: 'This marks the verification as failed for the end user.',
      confirmLabel: 'Reject',
    })
    if (ok) await act('reject')
  }

  const media = Array.isArray(data?.media) ? data.media : []
  const images = IMAGE_KINDS.filter((k) => media.includes(k))
  // Ordered list backing the lightbox: images first, then the liveness video.
  const mediaItems: MediaItem[] = [
    ...images.map((kind) => ({ kind })),
    ...(media.includes('video') ? [{ kind: 'video' }] : []),
  ]
  const ocrFields = data?.ocr?.fields ?? null
  const canReview = can('reviews.approve') || can('reviews.reject') || can('reviews.request_retry')

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Session"
        actions={
          <Link to="../" className="text-sm text-primary hover:underline">
            ← Sessions
          </Link>
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : data ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <Row label="Status">
                <StatusBadge status={data.status} />
              </Row>
              <Row label="Auto decision">
                <DecisionBadge decision={data.auto_decision} />
              </Row>
              <Row label="Final decision">
                <DecisionBadge decision={data.final_decision} />
              </Row>
              <Row label="Decision reason">{humanize(data.decision_reason)}</Row>
              <Row label="Risk score">{num(data.risk_score)}</Row>
              <Row label="Completed at">{formatDateTime(data.completed_at)}</Row>
              <Row label="Reviewed at">{formatDateTime(data.reviewed_at)}</Row>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <Row label="ID">
                <span className="font-mono text-xs">{data.id}</span>
              </Row>
              <Row label="User reference">{data.user_reference ?? '—'}</Row>
              <Row label="Project ID">
                <span className="font-mono text-xs">{data.project_id}</span>
              </Row>
              <Row label="Created at">{formatDateTime(data.created_at)}</Row>
              <Row label="Expires at">{formatDateTime(data.expires_at)}</Row>
            </CardContent>
          </Card>

          {media.length ? (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Captured media</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {images.map((kind, i) => (
                    <SessionMedia
                      key={kind}
                      organizationId={organizationId}
                      sessionId={data.id}
                      kind={kind}
                      onOpen={() => setLightbox(i)}
                    />
                  ))}
                </div>
                {media.includes('video') ? (
                  <div className="mt-4 max-w-md">
                    <SessionMedia
                      organizationId={organizationId}
                      sessionId={data.id}
                      kind="video"
                      onOpen={() => setLightbox(images.length)}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {ocrFields ? (
            <Card>
              <CardHeader>
                <CardTitle>OCR — extracted fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {Object.entries(ocrFields).map(([k, v]) => (
                  <Row key={k} label={humanize(k)}>
                    {v != null && v !== '' ? String(v) : '—'}
                  </Row>
                ))}
                <Row label="Confidence">{num(data.ocr?.confidence)}</Row>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <Row label="Document type">{humanize(data.document?.document_type)}</Row>
              <Row label="Document country">{data.document?.country ?? '—'}</Row>
              <Row label="Document quality">{num(data.document?.quality_score)}</Row>
              <Row label="Liveness">{bool(data.liveness?.passed)}</Row>
              <Row label="Liveness score">{num(data.liveness?.score)}</Row>
              <Row label="Face match">{bool(data.face_match?.passed)}</Row>
              <Row label="Face similarity">{num(data.face_match?.similarity_score)}</Row>
            </CardContent>
          </Card>

          {data.address ? (
            <Card>
              <CardHeader>
                <CardTitle>Address verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <Row label="Address verified">{bool(data.address.passed)}</Row>
                <Row label="Address score">{num(data.address.score)}</Row>
                <Row label="Claimed address">
                  {data.address.claimed_address
                    ? Object.values(data.address.claimed_address).filter(Boolean).join(', ') || '—'
                    : '—'}
                </Row>
                {(data.address.methods ?? []).map((m) => (
                  <Row key={m.method} label={humanize(m.method)}>
                    {bool(m.passed)} · {num(m.confidence)}
                    {m.note ? ` · ${m.note}` : ''}
                  </Row>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {canReview ? (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Override decision</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Textarea
                  placeholder="Reason (optional) — recorded with the review"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
                <div className="flex flex-wrap items-center gap-3">
                  {acting ? <Spinner /> : null}
                  {can('reviews.approve') ? (
                    <Button onClick={() => void act('approve')} disabled={acting}>
                      Approve
                    </Button>
                  ) : null}
                  {can('reviews.reject') ? (
                    <Button variant="destructive" onClick={() => void rejectWithConfirm()} disabled={acting}>
                      Reject
                    </Button>
                  ) : null}
                  {can('reviews.request_retry') ? (
                    <div className="flex items-center gap-2">
                      <Select
                        aria-label="Retry scope"
                        value={retryKind}
                        onChange={(e) => setRetryKind(e.target.value as 'document' | 'selfie' | 'full')}
                        className="w-auto"
                      >
                        <option value="full">Full retry</option>
                        <option value="document">Document only</option>
                        <option value="selfie">Selfie only</option>
                      </Select>
                      <Button variant="outline" onClick={() => void act('retry')} disabled={acting}>
                        Request retry
                      </Button>
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  A manager can approve or reject any session — including a pending or already-finalized one.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {lightbox != null && data ? (
        <MediaLightbox
          items={mediaItems}
          index={lightbox}
          organizationId={organizationId}
          sessionId={data.id}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  )
}
