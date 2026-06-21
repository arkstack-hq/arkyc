import { DB } from 'arkormx'
import { Job } from '@app/models/Job'

/** Seconds a reserved job may run before it's considered crashed and reclaimable. */
const VISIBILITY_TIMEOUT_SEC = 300

/** Base unit for quadratic retry backoff (attempt² × base). */
const BASE_BACKOFF_MS = 1000

/** Default delivery attempts before a job is dead-lettered. */
const DEFAULT_MAX_ATTEMPTS = 3

/**
 * Grace, in seconds, applied to the `available_at` check when claiming. Absorbs
 * small clock skew between the app (which stamps `available_at`) and Postgres
 * (whose `NOW()` the claim compares against) so an immediately-enqueued job is
 * claimable right away. Negligible for delayed jobs.
 */
const CLOCK_SKEW_GRACE_SEC = 2

export interface EnqueueOptions {
  /** Delivery attempts before dead-lettering (default 3). */
  maxAttempts?: number
  /** Delay before the job becomes runnable, in ms (default 0). */
  delayMs?: number
}

/**
 * Durable, Postgres-backed job queue (Phase 8).
 *
 * Jobs are claimed atomically with `UPDATE … RETURNING` over a
 * `FOR UPDATE SKIP LOCKED` subquery, so concurrent workers never grab the same
 * row. A reserved job whose worker crashed is reclaimed after the visibility
 * timeout, giving at-least-once delivery — handlers must be idempotent.
 */
export class Queue {
  /** Add a job to `queue`. */
  async enqueue(
    queue: string,
    payload: Record<string, unknown>,
    opts: EnqueueOptions = {},
  ): Promise<Job> {
    return Job.create({
      queue,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      availableAt: new Date(Date.now() + (opts.delayMs ?? 0)),
      reservedAt: null,
      lastError: null,
    })
  }

  /**
   * Atomically reserve the next runnable job — a `pending` one that's due, or a
   * `reserved` one past the visibility timeout (crashed worker). Increments
   * `attempts`. Returns `null` when nothing is runnable.
   */
  async claim(queue?: string): Promise<Job | null> {
    const rows = await DB.raw<{ id: string }>(
      `UPDATE jobs
          SET status = 'reserved', reserved_at = NOW(), attempts = attempts + 1, updated_at = NOW()
        WHERE id = (
          SELECT id FROM jobs
           WHERE (
                   (status = 'pending' AND available_at <= NOW() + make_interval(secs => ?))
                OR (status = 'reserved' AND reserved_at < NOW() - make_interval(secs => ?))
                 )
             ${queue ? 'AND queue = ?' : ''}
           ORDER BY available_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
      RETURNING id`,
      queue
        ? [CLOCK_SKEW_GRACE_SEC, VISIBILITY_TIMEOUT_SEC, queue]
        : [CLOCK_SKEW_GRACE_SEC, VISIBILITY_TIMEOUT_SEC],
    )

    const row = Array.from(rows)[0]

    return row ? Job.where({ id: row.id }).first() : null
  }

  /** Mark a job done. */
  async complete(job: Job): Promise<void> {
    job.status = 'completed'
    job.reservedAt = null
    await job.save()
  }

  /**
   * Record a failure: reschedule with quadratic backoff while attempts remain,
   * otherwise dead-letter the job.
   */
  async fail(job: Job, error: unknown): Promise<void> {
    job.lastError = error instanceof Error ? error.message : String(error)
    job.reservedAt = null

    if (job.attempts >= job.maxAttempts) {
      job.status = 'dead'
    } else {
      job.status = 'pending'
      job.availableAt = new Date(Date.now() + BASE_BACKOFF_MS * job.attempts * job.attempts)
    }

    await job.save()
  }
}

/** Shared singleton queue. */
export const queue = new Queue()
