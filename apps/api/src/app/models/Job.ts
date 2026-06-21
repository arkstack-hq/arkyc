import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'

/** Lifecycle states for a queued job. */
export type JobStatus = 'pending' | 'reserved' | 'completed' | 'failed' | 'dead'

/** A durable queue job (Phase 8). See the `jobs` migration for the schema. */
export class Job extends Model {
  protected static override table = 'jobs'

  declare id: string
  declare queue: string
  declare payload: Record<string, unknown> | null
  declare status: JobStatus
  declare attempts: number
  declare maxAttempts: number
  declare availableAt: Date
  declare reservedAt: Date | null
  declare lastError: string | null
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    maxAttempts: 'max_attempts',
    availableAt: 'available_at',
    reservedAt: 'reserved_at',
    lastError: 'last_error',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    payload: 'json',
  }
}
