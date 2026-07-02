import { ACCESS_CAPABILITY_KEYS } from '@arkyc/types'
import { Resource } from 'resora'

type Related = { getAttribute(key: string): unknown }

/** A project in the admin organization view, carrying its extended-access status per capability. */
export default class AdminProjectResource extends Resource {
  data() {
    const rel = this.resource.getAttribute('accessGrants') as Iterable<Related> | undefined
    const grants = rel ? Array.from(rel) : []

    const extendedAccess: Record<string, { status: string; requested_at: unknown; reviewed_at: unknown }> = {}
    for (const capability of ACCESS_CAPABILITY_KEYS) {
      const grant = grants.find((g) => g.getAttribute('capability') === capability)
      extendedAccess[capability] = {
        status: (grant?.getAttribute('status') as string) ?? 'none',
        requested_at: grant?.getAttribute('requestedAt') ?? null,
        reviewed_at: grant?.getAttribute('reviewedAt') ?? null,
      }
    }

    return {
      id: this.id,
      name: this.name,
      environment: this.environment,
      status: this.status,
      extended_access: extendedAccess,
    }
  }
}
