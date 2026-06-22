import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from './card'

export interface StatDelta {
  /** Signed percentage change; 0 renders as neutral. */
  value: number
  /** Trailing context, e.g. "from last week". */
  label?: string
}

/** A compact metric tile: label, large value, optional icon + trend delta/hint. */
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
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {delta ? (
        <p className="mt-2 flex items-center gap-1 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums',
              up ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
            )}
          >
            {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {up ? '+' : ''}
            {delta.value.toFixed(1)}%
          </span>
          {delta.label ? <span className="text-muted-foreground">{delta.label}</span> : null}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  )
}
