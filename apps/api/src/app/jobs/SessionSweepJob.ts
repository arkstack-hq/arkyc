import { Cache } from '@arkstack/cache'
import { Job } from '@arkstack/jobs'
import { retentionService } from '@app/services/RetentionService'
import { faceEmbeddings } from '@app/services/risk/FaceEmbeddingStore'
import { screeningMonitors } from '@app/services/risk/ScreeningMonitorService'
import { sessionService } from '@app/services/VerificationSessionService'
import { queueRunsInline, sessionSweepDriver, sessionSweepIntervalSeconds } from 'src/support/session-sweep'

/** Overlap lease so duplicate chains (e.g. a double `--loop`) converge to one. */
const LEASE_KEY = 'session-sweep:lease'
/** Once-per-day throttle so retention rides the sweep chain without its own cron/job. */
const RETENTION_KEY = 'retention:daily'
const SCREENING_KEY = 'screening-monitor:hourly'
const DAY_SECONDS = 86_400
const HOUR_SECONDS = 3_600

/**
 * Session-expiry sweep as a self-perpetuating queued job (queue `queue.queues.maintenance`).
 * Runs one `sweepExpired()` batch, then re-queues itself after the configured
 * interval — so the sweep rides the queue worker with no cron (portable to hosts
 * like Railway). Active only when `SESSION_SWEEP_DRIVER=queue`; on an inline
 * (`sync`) connection it refuses to re-arm (that would recurse). Start the chain
 * once with `ark session:sweep --loop`.
 */
export class SessionSweepJob extends Job {
  override queue = config('queue.queues.maintenance', 'maintenance')
  // The chain provides continuity; a single failed run shouldn't retry-storm.
  override tries = 1

  async handle(): Promise<void> {
    // Driver switched away (or inline connection) → let the chain die here.
    if (sessionSweepDriver() !== 'queue' || queueRunsInline()) return

    const interval = sessionSweepIntervalSeconds()
    // Hold a lease just shy of the interval so the sole survivor re-acquires next
    // cycle while a duplicate chain due in the same window backs off and dies.
    const lease = await Cache.add(LEASE_KEY, '1', Math.max(5, interval - 10))

    if (!lease) return

    try {
      await sessionService.sweepExpired()
      // Ride the same chain for daily data retention — first sweep of the day wins
      // the throttle and runs it; the rest skip. Keeps the queue driver cron-free.
      if (await Cache.add(RETENTION_KEY, '1', DAY_SECONDS)) {
        await retentionService.purgeExpiredMedia().catch(() => {})
        await faceEmbeddings.purgeExpired().catch(() => {})
      }

      if (await Cache.add(SCREENING_KEY, '1', HOUR_SECONDS)) {
        await screeningMonitors.runDue().catch(() => {})
      }
    } finally {
      // Re-arm even if the batch threw, so a transient error can't break the loop.
      await SessionSweepJob.dispatch().withDelay(interval)
    }
  }
}
