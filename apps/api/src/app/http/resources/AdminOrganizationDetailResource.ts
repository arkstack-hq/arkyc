import { Resource } from 'resora'

/**
 * Platform-admin organization detail: core fields and headline counts. The org's
 * projects are paginated separately (admin org-projects endpoint).
 */
export default class AdminOrganizationDetailResource extends Resource {
  data() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      logo_url: this.logoUrl ?? null,
      created_at: this.createdAt,
      verification_status: this.verificationStatus ?? 'unverified',
      verified_at: this.verifiedAt ?? null,
      last_session_at: this.lastSessionAt ?? null,
      counts: this.counts,
      stats: this.stats,
    }
  }
}
