import { Resource } from 'resora'

/**
 * Comprehensive platform-admin statistics: headline totals, user/session and
 * extended-access breakdowns, and a daily session trend. Built as a plain object
 * by the controller; this just frames it in the response envelope.
 */
export default class AdminStatsResource extends Resource {
  data() {
    return {
      totals: this.totals,
      users: this.users,
      sessions: this.sessions,
      extended_access: this.extendedAccess,
      trend: this.trend,
    }
  }
}
