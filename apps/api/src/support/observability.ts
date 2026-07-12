import { Logger } from '@arkstack/common'

/**
 * Observability seams (Phase 20). Vendor-neutral by design: errors are always
 * logged structured via the framework `Logger`, and optionally forwarded to a
 * pluggable external reporter (Sentry, etc.) registered at boot. Metrics go
 * through a no-op sink until a backend is wired. Nothing here throws — broken
 * instrumentation must never cascade into request handling.
 */

/** External error sink (e.g. Sentry `captureException`). */
export type ErrorReporter = (error: Error, context?: Record<string, unknown>) => void | Promise<void>

let reporter: ErrorReporter | null = null

/** Register (or clear) the external error reporter. Call once at boot. */
export function setErrorReporter(fn: ErrorReporter | null): void {
  reporter = fn
}

/**
 * Report an error: structured log always, plus the external reporter when set.
 * Safe to call from anywhere, including catch blocks that must not rethrow.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error))

  try {
    Logger.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack, ...context }))
  } catch {
    // Logging must never throw.
  }

  if (!reporter) return
  try {
    const result = reporter(err, context)
    if (result instanceof Promise) result.catch(() => {})
  } catch {
    // A broken reporter must not cascade.
  }
}

/** Minimal metrics interface — swap the sink for a real backend (StatsD, OTel, …). */
export interface Metrics {
  increment(name: string, value?: number, tags?: Record<string, string>): void
  timing(name: string, ms: number, tags?: Record<string, string>): void
}

const noopMetrics: Metrics = { increment: () => {}, timing: () => {} }
let sink: Metrics = noopMetrics

/** Register (or reset to no-op) the metrics sink. */
export function setMetrics(next: Metrics | null): void {
  sink = next ?? noopMetrics
}

/** The active metrics sink (no-op until configured). */
export function metrics(): Metrics {
  return sink
}
