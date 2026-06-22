import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** A shimmering placeholder for content that is still loading. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}
