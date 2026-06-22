/**
 * @arkyc/realtime
 *
 * Server-side realtime event broadcasting for Arkyc (Phase 16). A small driver
 * abstraction over pusher (hosted Pusher Channels or self-hosted soketi) and
 * firebase, plus `memory` (tests) and `off` (disabled). The active driver is
 * chosen at runtime by the platform `realtime.transport` setting; call sites
 * depend only on {@link RealtimeDriver}.
 */
export * from './types'
export * from './registry'
export { OffRealtimeDriver } from './drivers/off'
export { MemoryRealtimeDriver, type RecordedEvent } from './drivers/memory'
export { PusherRealtimeDriver } from './drivers/pusher'
export { FirebaseRealtimeDriver } from './drivers/firebase'
