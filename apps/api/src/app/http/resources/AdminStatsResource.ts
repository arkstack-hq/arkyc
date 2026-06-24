import { Resource } from 'resora'

/**
 * Comprehensive platform-admin statistics: headline totals, user/session/AI
 * breakdowns, and a daily session trend. Built as a plain object by the
 * controller; this just frames it in the response envelope.
 */
export default class AdminStatsResource extends Resource {
  data() {
    return {
      totals: this.totals,
      users: this.users,
      sessions: this.sessions,
      ai_access: this.aiAccess,
      trend: this.trend,
    }
  }
}
