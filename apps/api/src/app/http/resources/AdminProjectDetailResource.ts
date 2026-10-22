import { Resource } from 'resora'

/** One project as platform admins see it: configuration, usage, outcomes and access. */
export default class AdminProjectDetailResource extends Resource {
  data() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      environment: this.environment,
      status: this.resource.status,
      created_at: this.createdAt,
      organization: this.organization,
      thresholds: this.thresholds,
      counts: this.counts,
      stats: this.stats,
      extended_access: this.extendedAccess,
      recent_sessions: this.recentSessions,
    }
  }
}
