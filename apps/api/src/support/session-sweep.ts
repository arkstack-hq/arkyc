import { config, env } from '@arkstack/common'

/**
 * How the verification-session expiry sweep is driven (Phase 20 hardening):
 *
 * - `schedule` (default): the framework scheduler (`routes/console.ts`) runs it
 *   on a cadence — a system cron calling `ark schedule:run`, or a long-running
 *   `ark schedule:work` process.
 * - `queue`: a self-perpetuating `SessionSweepJob` re-queues itself with a delay,
 *   so the sweep rides the existing queue worker with no cron — portable to hosts
 *   like Railway. Start it once with `ark session:sweep --loop`.
 * - `off`: neither; sessions expire only lazily when a reader touches them.
 */
export type SessionSweepDriver = 'schedule' | 'queue' | 'off'

/** The configured sweep driver (`SESSION_SWEEP_DRIVER`), defaulting to `schedule`. */
export function sessionSweepDriver(): SessionSweepDriver {
  const value = String(env('SESSION_SWEEP_DRIVER', 'schedule')).toLowerCase()

  return value === 'queue' || value === 'off' ? value : 'schedule'
}

/**
 * Seconds between sweep runs (the queue driver's self-reschedule delay). Floored
 * at 30s so a misconfiguration can't spin the queue. Defaults to 5 minutes.
 */
export function sessionSweepIntervalSeconds(): number {
  const n = Number(env('SESSION_SWEEP_INTERVAL', 300))

  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : 300
}

/**
 * True when the default queue connection runs jobs inline (`sync`). A self-
 * rescheduling job would recurse forever there, so the queue driver refuses to
 * re-arm on an inline connection.
 */
export function queueRunsInline(): boolean {
  return String(config('queue.default', 'sync')) === 'sync'
}
