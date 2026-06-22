import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'

export interface StatDelta {
  /** Signed percentage change; 0 renders as neutral. */
  value: number
  /** Trailing context, e.g. "from last week". */
  label?: string
}

/**
 * A metric tile in the shadcn-uikit style: label + bare icon on top, a colored
 * percentage delta line, then a large value at the bottom. Flat: border only.
 */
export function StatCard({
  label,
  value,
  icon,
  hint,
  delta,
  className,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  delta?: StatDelta
  className?: string
}) {
  const up = delta ? delta.value >= 0 : false
  return (
    <Card className={cn('rounded-xl p-6', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground [&_svg]:size-5">{icon}</span> : null}
      </div>
      {delta ? (
        <p className="mt-3 text-sm">
          <span className={cn('font-medium tabular-nums', up ? 'text-success' : 'text-destructive')}>
            {up ? '+' : ''}
            {delta.value.toFixed(1)}%
          </span>{' '}
          {delta.label ? <span className="text-muted-foreground">{delta.label}</span> : null}
        </p>
      ) : hint ? (
        <p className="mt-3 text-sm text-muted-foreground">{hint}</p>
      ) : null}
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
    </Card>
  )
}
