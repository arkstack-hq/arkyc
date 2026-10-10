import { CACHE, alova, unwrap } from './client'
import type { RealtimeServerConfig } from '@/lib/realtime/client'

/** Realtime transport discovery. */
export class Realtime {
  /** How the browser should connect to the active transport. */
  static config() {
    return alova.Get('/v1/realtime/config', {
      name: 'realtime:config',
      cacheFor: CACHE,
      transform: unwrap<RealtimeServerConfig>,
    })
  }
}
