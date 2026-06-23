import { useCallback, useEffect, useState } from 'react'

import { getStoredRateLimitForRequest } from '@/lib/requests/rate-limit'

/**
 * Track the remaining cooldown (in seconds) for a rate-limited request, ticking
 * down once per second. The limit is persisted by the alova response handler
 * whenever the server answers `429` with a `Retry-After` header, so this reads
 * the same store the interceptor writes — no extra round-trips.
 *
 * @param methodType HTTP verb of the throttled request (e.g. `'POST'`).
 * @param url The alova method url of the throttled request (e.g. `'/v1/auth/forgot'`).
 * @returns The remaining seconds and a `refresh` to re-read the store on demand.
 */
export function useRateLimit(methodType: string, url: string) {
  const [seconds, setSeconds] = useState(0)

  const read = useCallback(() => getStoredRateLimitForRequest(methodType, url), [methodType, url])

  const refresh = useCallback(async () => {
    setSeconds(await read())
  }, [read])

  useEffect(() => {
    let active = true
    const tick = async () => {
      const remaining = await read()
      if (active) setSeconds(remaining)
    }
    void tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [read])

  return { seconds, refresh }
}
