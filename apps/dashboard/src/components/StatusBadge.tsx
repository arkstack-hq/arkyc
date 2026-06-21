import type { VerificationDecision, VerificationStatus } from '@arkyc/types'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { humanize } from '@/lib/utils'

const STATUS_VARIANT: Record<VerificationStatus, BadgeProps['variant']> = {
  approved: 'success',
  rejected: 'destructive',
  requires_review: 'warning',
  processing: 'secondary',
  pending: 'muted',
  started: 'secondary',
  document_submitted: 'secondary',
  liveness_submitted: 'secondary',
  expired: 'muted',
  cancelled: 'muted',
}

const DECISION_VARIANT: Record<VerificationDecision, BadgeProps['variant']> = {
  approved: 'success',
  rejected: 'destructive',
  requires_review: 'warning',
}

export function StatusBadge({ status }: { status: VerificationStatus }) {
  return <Badge variant={STATUS_VARIANT[status] ?? 'muted'}>{humanize(status)}</Badge>
}

export function DecisionBadge({ decision }: { decision: VerificationDecision | null | undefined }) {
  if (!decision) return <span className="text-muted-foreground">—</span>
  return <Badge variant={DECISION_VARIANT[decision] ?? 'muted'}>{humanize(decision)}</Badge>
}
