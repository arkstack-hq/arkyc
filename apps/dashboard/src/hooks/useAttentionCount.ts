import { useEffect } from 'react'
import { useRequest } from 'alova/client'
import type { Method } from 'alova'

const REFRESH_MS = 60_000

/**
 * A count of things waiting for the user, kept fresh on an interval and when the
 * window regains focus. Disabled counts stay at zero.
 */
export function useAttentionCount(method: () => Method, enabled = true): number {
  const { data, send } = useRequest(method, { immediate: enabled, initialData: 0 })

  useEffect(() => {
    if (!enabled) return

    const refresh = () => void send().catch(() => {})
    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener('focus', refresh)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [enabled, send])

  return enabled ? ((data as number) ?? 0) : 0
}
