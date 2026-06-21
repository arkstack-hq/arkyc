import { useEffect, useRef } from 'react'
import { Spinner } from '@/components/ui/spinner'

interface InfiniteScrollProps {
  /** Load the next page. Called when the sentinel scrolls into view. */
  onLoadMore: () => void
  /** Whether the last page has been reached (stops observing). */
  isLast: boolean
  /** Whether a page is currently loading (shows a spinner, guards re-entry). */
  loading: boolean
}

/**
 * Sentinel that triggers `onLoadMore` when scrolled into view (Intersection
 * Observer), with a manual "Load more" fallback. Pair with alova's
 * `usePagination({ append: true })` for infinite-scroll lists.
 */
export function InfiniteScroll({ onLoadMore, isLast, loading }: InfiniteScrollProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node || isLast) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) onLoadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [onLoadMore, isLast, loading])

  if (isLast) return null

  return (
    <div ref={ref} className="flex justify-center py-6">
      {loading ? (
        <Spinner />
      ) : (
        <button
          type="button"
          onClick={onLoadMore}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Load more
        </button>
      )}
    </div>
  )
}
