import type { ChannelAuthRequest, ChannelAuthResponse, RealtimeDriver } from '../types'

/** A single recorded broadcast. */
export interface RecordedEvent {
  channels: readonly string[]
  event: string
  payload: unknown
}

// The buffer lives on `globalThis` so it is shared even when the package is
// loaded into more than one module graph in the same process (e.g. a test's
// transformed graph + the app's runtime dynamic-import graph under vitest).
const BUFFER_KEY = '__arkyc_realtime_memory_events__'

function buffer(): RecordedEvent[] {
  const g = globalThis as Record<string, unknown>
  if (!g[BUFFER_KEY]) g[BUFFER_KEY] = []
  return g[BUFFER_KEY] as RecordedEvent[]
}

/**
 * An in-memory driver for dev + tests. Records every `publish` to a shared
 * buffer so tests can assert what was broadcast without a live transport.
 */
export class MemoryRealtimeDriver implements RealtimeDriver {
  readonly name = 'memory' as const

  /** All events published since the last {@link MemoryRealtimeDriver.clear}. */
  static get events(): RecordedEvent[] {
    return buffer()
  }

  /** Reset the recorded buffer (call between tests). */
  static clear(): void {
    buffer().length = 0
  }

  async publish(channels: readonly string[], event: string, payload: unknown): Promise<void> {
    buffer().push({ channels: [...channels], event, payload })
  }

  clientConfig(): Record<string, unknown> {
    return {}
  }

  async authorizeChannel(request: ChannelAuthRequest): Promise<ChannelAuthResponse> {
    // Tests don't connect a real socket; return a deterministic stub signature.
    return { auth: `memory:${request.channel}` }
  }
}
