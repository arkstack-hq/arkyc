import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'

/** A compact metric tile: label, large value, optional icon + hint/delta. */
export function StatCard({
  label,
  value,
  icon,
  hint,
  className,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  className?: string
}) {
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
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}
