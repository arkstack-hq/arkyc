import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PaginationProps {
  /** Current 1-based page. */
  page: number
  /** Total number of pages (alova's `pageCount`, which may be undefined pre-load). */
  pageCount: number | undefined
  /** Navigate to a page. */
  onPage: (page: number) => void
  /** Disable the controls while a page is loading. */
  loading?: boolean
  className?: string
}

/**
 * Standard prev/next pagination with a page indicator. Pair with alova's
 * `usePagination({ append: false })`, passing `page`/`pageCount` and
 * `onPage={(p) => update({ page: p })}`. Renders nothing for a single page.
 */
export function Pagination({ page, pageCount, onPage, loading, className }: PaginationProps) {
  if (!pageCount || pageCount <= 1) return null

  return (
    <div className={cn('flex items-center justify-between gap-2 px-2 py-3', className)}>
      <span className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={loading || page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}
