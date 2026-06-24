import { DB } from 'arkormx'
import { BaseController } from '@controllers/BaseController'
import AdminStatsResource from '@app/http/resources/AdminStatsResource'
import { toArray } from 'src/support/collection'
import { Organization } from '@app/models/Organization'
import { User } from '@app/models/User'
import { Project } from '@app/models/Project'
import { VerificationSession } from '@app/models/VerificationSession'
import { ApiKey } from '@app/models/ApiKey'
import { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import { Review } from '@app/models/Review'
import { AdminPermission } from '@app/models/AdminPermission'

/** Every verification status, so the breakdown always has a full, zero-filled shape. */
const SESSION_STATUSES = [
  'pending',
  'started',
  'document_submitted',
  'liveness_submitted',
  'processing',
  'requires_review',
  'approved',
  'rejected',
  'expired',
  'cancelled',
] as const

const GRANT_STATUSES = ['pending', 'granted', 'revoked'] as const

/** Days of session history in the trend series. */
const TREND_DAYS = 30

// `DB.raw<TRow>` requires `TRow extends Record<string, unknown>`, hence the index signatures.
interface KeyCountRow {
  key: string
  count: number
  [column: string]: unknown
}

interface DayCountRow {
  day: string
  count: number
  [column: string]: unknown
}

const toCount = (value: unknown): number => Number(value) || 0

/**
 * Platform-wide statistics for the admin overview — the same shape of headline
 * counts we show per organization, but aggregated across the whole platform and
 * far more comprehensive. All aggregation runs in the database (counts +
 * grouped/raw queries), so it scales past what a client could compute.
 *
 * Gated by `admin.organizations.view`.
 */
export default class StatsController extends BaseController {
  async index() {
    const [
      organizations,
      users,
      projects,
      sessions,
      apiKeys,
      webhooks,
      reviews,
      restricted,
      suspended,
      sessionStatusRows,
      grantStatusRows,
      trendRows,
      last7Days,
      last30Days,
      adminGrants,
    ] = await Promise.all([
      Organization.query().count(),
      User.query().count(),
      Project.query().count(),
      VerificationSession.query().count(),
      ApiKey.query().count(),
      WebhookEndpoint.query().count(),
      Review.query().count(),
      User.where({ status: 'restricted' }).count(),
      User.where({ status: 'suspended' }).count(),
      DB.raw<KeyCountRow>(`SELECT status AS key, COUNT(*)::int AS count FROM verification_sessions GROUP BY status`),
      DB.raw<KeyCountRow>(`SELECT status AS key, COUNT(*)::int AS count FROM ai_processing_grants GROUP BY status`),
      DB.raw<DayCountRow>(
        `SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM verification_sessions
         WHERE created_at >= (CURRENT_DATE - INTERVAL '${TREND_DAYS - 1} days')
         GROUP BY day
         ORDER BY day`,
      ),
      VerificationSession.query().whereRaw(`created_at >= (NOW() - INTERVAL '7 days')`).count(),
      VerificationSession.query().whereRaw(`created_at >= (NOW() - INTERVAL '30 days')`).count(),
      AdminPermission.all(),
    ])

    const byStatus = tally(sessionStatusRows, SESSION_STATUSES)
    const aiAccess = tally(grantStatusRows, GRANT_STATUSES)
    // A user may hold several admin-permission grants; count distinct users.
    const admins = new Set(toArray(adminGrants).map((grant) => grant.userId)).size
    const decided = byStatus.approved + byStatus.rejected

    const stats = {
      totals: {
        organizations,
        users,
        projects,
        sessions,
        api_keys: apiKeys,
        webhooks,
        reviews,
        admins,
      },
      users: {
        active: Math.max(0, users - restricted - suspended),
        restricted,
        suspended,
        admins,
      },
      sessions: {
        total: sessions,
        by_status: byStatus,
        approved: byStatus.approved,
        rejected: byStatus.rejected,
        requires_review: byStatus.requires_review,
        approval_rate: decided ? byStatus.approved / decided : 0,
        last_7_days: last7Days,
        last_30_days: last30Days,
      },
      aiAccess,
      trend: buildTrend(toArray(trendRows)),
    }

    return new AdminStatsResource(stats).additional({ status: 'success', message: 'OK', code: 200 })
  }
}

/** Fold grouped `{ key, count }` rows into a zero-filled map over `keys`. */
function tally(rows: Iterable<KeyCountRow> | null | undefined, keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const key of keys) out[key] = 0
  for (const row of toArray(rows)) {
    if (row && row.key in out) out[row.key] = toCount(row.count)
  }

  return out
}

/** A continuous `TREND_DAYS`-long daily series ending today, zero-filling gaps. */
function buildTrend(rows: DayCountRow[]): { date: string; count: number }[] {
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
