import type { Project } from '@arkyc/types'
import { CACHE, type Paginated, alova, p, params, t, unwrap } from './client'
import type { CreateProjectInput } from './types'

/** Large page size for "fetch all" picker/dropdown calls. */
const PICKER_LIMIT = 200

/** Projects (applications/environments) scoped to a tenant. */
export class Projects {
  /**
   * Paginated project list. Pass `page`/`limit` (usePagination supplies these);
   * list views consume it via infinite scroll.
   */
  static list(tenantId: string, query?: { page?: number; limit?: number }) {
    return alova.Get<Paginated<Project>>(`${t(tenantId)}/projects`, {
      name: 'projects:list',
      cacheFor: CACHE,
      hitSource: ['project:create', 'project:update'],
      params: params(query),
    })
  }

  /** All projects in one shot, for filter dropdowns/pickers (simple-data fetch). */
  static options(tenantId: string) {
    return alova.Get(`${t(tenantId)}/projects`, {
      name: 'projects:options',
      cacheFor: CACHE,
      hitSource: ['project:create', 'project:update'],
      params: { limit: String(PICKER_LIMIT) },
      transform: unwrap<Project[]>,
    })
  }

  /** Show a single project. */
  static get(tenantId: string, projectId: string) {
    return alova.Get(p(tenantId, projectId), {
      name: 'project:detail',
      cacheFor: CACHE,
      hitSource: ['project:update'],
      transform: unwrap<Project>,
    })
  }

  /** Create a project. */
  static create(tenantId: string, input: CreateProjectInput) {
    return alova.Post(`${t(tenantId)}/projects`, input, {
      name: 'project:create',
      transform: unwrap<Project>,
    })
  }

  /** Update a project (name, branding, settings, thresholds). */
  static update(tenantId: string, projectId: string, input: Partial<CreateProjectInput>) {
    return alova.Patch(p(tenantId, projectId), input, {
      name: 'project:update',
      transform: unwrap<Project>,
    })
  }
}
