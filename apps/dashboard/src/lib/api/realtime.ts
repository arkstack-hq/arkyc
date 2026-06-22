import { CACHE, alova, unwrap } from './client'
import type { RealtimeConnectionConfig } from '@/lib/realtime/client'

/** Realtime transport discovery (Phase 16). */
export class Realtime {
  /** How the browser should connect to the active transport (or `off`/`memory`). */
  static config() {
    return alova.Get('/v1/realtime/config', {
      name: 'realtime:config',
      cacheFor: CACHE,
      transform: unwrap<RealtimeConnectionConfig>,
    })
  }
}
