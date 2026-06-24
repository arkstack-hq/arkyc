import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { fetchSessionMedia } from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'
import { humanize } from '@/lib/utils'

export interface MediaItem {
  kind: string
}

/**
 * Full-screen media viewer for captured session media. Opens at `index` and
 * slides through every item (←/→ or the on-screen arrows; Esc closes), showing
 * the kind as a caption. Each item's bytes are fetched on demand through the
 * authenticated media route.
 */
export function MediaLightbox({
  items,
  index,
  organizationId,
  sessionId,
  onIndex,
  onClose,
}: {
  items: MediaItem[]
  index: number
  organizationId: string
  sessionId: string
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const item = items[index]
  const kind = item?.kind
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!kind) return
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      else if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, items.length, onIndex, onClose])

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose} role="presentation">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm text-white/80">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-12 pb-2" onClick={(e) => e.stopPropagation()}>
        {index > 0 ? (
          <button
            type="button"
            aria-label="Previous"
            onClick={() => onIndex(index - 1)}
            className="absolute left-3 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="size-6" />
          </button>
        ) : null}

        {failed ? (
          <span className="text-sm text-white/60">Media unavailable</span>
        ) : !url ? (
          <Spinner />
        ) : kind === 'video' ? (
          <video src={url} controls autoPlay className="max-h-full max-w-full rounded-md" />
        ) : (
          <img src={url} alt={humanize(kind)} className="max-h-full max-w-full rounded-md object-contain" />
        )}

        {index < items.length - 1 ? (
          <button
            type="button"
            aria-label="Next"
            onClick={() => onIndex(index + 1)}
            className="absolute right-3 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="size-6" />
          </button>
        ) : null}
      </div>

      <div className="pb-5 pt-1 text-center text-sm font-medium text-white/90">{humanize(kind)}</div>
    </div>
  )
}
