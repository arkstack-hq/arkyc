import { Resource } from 'resora'

type Related = { getAttribute(key: string): unknown } | null | undefined

const ref = (model: Related, fields: string[]): Record<string, unknown> | null => {
  if (!model || typeof model.getAttribute !== 'function') return null
  const out: Record<string, unknown> = {}
  for (const f of fields) out[f] = model.getAttribute(f)

  return out
}

/**
 * A project's AI-processing access record. Nested `project`/`organization`/
 * `requester`/`reviewer` are included only when eager-loaded (admin surface);
 * the owner surface returns the bare status fields. Tolerates a plain-object
 * resource (the synthetic `none` status when a project has never requested).
 */
export default class AiAccessGrantResource extends Resource {
  /** Eager-loaded relation, or null when the backing resource is a plain object. */
  private relation(key: string): Related {
    const r = this.resource as { getAttribute?: (k: string) => unknown }

    return (typeof r?.getAttribute === 'function' ? r.getAttribute(key) : undefined) as Related
  }

  data() {
    return {
      id: this.id ?? null,
      organization_id: this.organizationId,
      project_id: this.projectId,
      status: this.status,
      note: this.note ?? null,
      requested_by: this.requestedBy ?? null,
      requested_at: this.requestedAt ?? null,
      reviewed_by: this.reviewedBy ?? null,
      reviewed_at: this.reviewedAt ?? null,
      created_at: this.createdAt ?? null,
      updated_at: this.updatedAt ?? null,
      project: ref(this.relation('project'), ['id', 'name']),
      organization: ref(this.relation('organization'), ['id', 'name']),
      requester: ref(this.relation('requester'), ['id', 'name', 'email']),
      reviewer: ref(this.relation('reviewer'), ['id', 'name', 'email']),
    }
  }
}
