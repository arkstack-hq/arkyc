import { DB } from 'arkormx'
import { toArray } from 'src/support/collection'

/** Every verification status, so a breakdown always has a full, zero-filled shape. */
export const SESSION_STATUSES = [
  'pending',
  'started',
  'document_submitted',
  'address_submitted',
  'liveness_submitted',
  'processing',
  'requires_review',
  'approved',
  'rejected',
  'expired',
  'cancelled',
] as const

/** Days of session history in a trend series. */
export const TREND_DAYS = 30

// `DB.raw<TRow>` requires `TRow extends Record<string, unknown>`, hence the index signatures.
export interface KeyCountRow {
  key: string
  count: number
  [column: string]: unknown
}

export interface DayCountRow {
  day: string
  count: number
  [column: string]: unknown
}

const toCount = (value: unknown): number => Number(value) || 0

/**
 * Fold grouped `{ key, count }` rows into a zero-filled map over `keys`.
 *
 * @param rows
 * @param keys
 * @returns
 */
export function tally(rows: Iterable<KeyCountRow> | null | undefined, keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {}

  for (const key of keys) out[key] = 0
  for (const row of toArray(rows)) {
    if (row && row.key in out) out[row.key] = toCount(row.count)
  }

  return out
}

/**
 * A continuous `TREND_DAYS`-long daily series ending today, zero-filling gaps.
 *
 * @param rows
 * @returns
 */
export function buildTrend(rows: DayCountRow[]): { date: string; count: number }[] {
  const counts = new Map(rows.map((row) => [row.day, toCount(row.count)]))
  const days: { date: string; count: number }[] = []
  const today = new Date()

  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const date = new Date(today)

    date.setDate(date.getDate() - i)
    const key = date.toISOString().slice(0, 10)

    days.push({ date: key, count: counts.get(key) ?? 0 })
  }

  return days
}

/**
 * Session outcomes for one organization or project, aggregated in the database:
 * totals by status, approval rate, recent volume, a daily trend, and risk signals.
 *
 * @param scope
 * @param id
 * @returns
 */
export async function scopedSessionStats(scope: 'organization_id' | 'project_id', id: string) {
  const [statusRows, trendRows, recentRows, signalRows] = await Promise.all([
    DB.raw<KeyCountRow>(
      `SELECT status AS key, COUNT(*)::int AS count FROM verification_sessions WHERE ${scope} = ? GROUP BY status`,
      [id],
    ),
    DB.raw<DayCountRow>(
      `SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM verification_sessions
        WHERE ${scope} = ? AND created_at >= (CURRENT_DATE - INTERVAL '${TREND_DAYS - 1} days')
        GROUP BY day
        ORDER BY day`,
      [id],
    ),
    DB.raw<KeyCountRow>(
      `SELECT CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 'last_7_days' ELSE 'last_30_days' END AS key,
              COUNT(*)::int AS count
         FROM verification_sessions
        WHERE ${scope} = ? AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY key`,
      [id],
    ),
    DB.raw<KeyCountRow>(
      `SELECT key, COUNT(*)::int AS count FROM session_risk_signals
        WHERE ${scope} = ? AND created_at >= NOW() - INTERVAL '30 days' AND cleared_at IS NULL
        GROUP BY key ORDER BY count DESC LIMIT 5`,
      [id],
    ),
  ])

  const byStatus = tally(statusRows, SESSION_STATUSES)
  const recent = tally(recentRows, ['last_7_days', 'last_30_days'])
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)
  const decided = byStatus.approved! + byStatus.rejected!

  return {
    total,
    by_status: byStatus,
    approval_rate: decided ? byStatus.approved! / decided : 0,
    requires_review: byStatus.requires_review!,
    last_7_days: recent.last_7_days!,
    last_30_days: recent.last_7_days! + recent.last_30_days!,
    trend: buildTrend(toArray(trendRows)),
    top_risk_signals: toArray(signalRows).map((row) => ({ key: row.key, count: toCount(row.count) })),
  }
}
