import type { Id, OrganizationScoped } from '@arkyc/types'

/** Identifies the organization + project a request or entity belongs to. */
export interface OrganizationProjectContext {
  organizationId: Id
  projectId: Id
}

/**
 * Thrown when an entity is accessed outside its organization/project scope.
 */
export class OrganizationScopeError extends Error {
  constructor(message = 'Entity is outside the active organization scope') {
    super(message)
    this.name = 'OrganizationScopeError'
  }
}

/** Organization/project scoping and storage-path helpers. */
export class OrganizationContext {
  /**
   * Whether `entity` belongs to the given organization.
   *
   * @param entity
   * @param organizationId
   * @returns
   */
  static belongsTo(entity: OrganizationScoped, organizationId: Id): boolean {
    return entity.organization_id === organizationId
  }

  /**
   * Assert that `entity` belongs to `organizationId`, throwing {@link OrganizationScopeError}
   * otherwise. Returns the entity (narrowed) for inline use.
   *
   * @param entity
   * @param organizationId
   * @returns
   */
  static assertScope<T extends OrganizationScoped>(entity: T, organizationId: Id): T {
    if (!OrganizationContext.belongsTo(entity, organizationId)) {
      throw new OrganizationScopeError()
    }
    return entity
  }

  /**
   * Build the canonical, organization/project-scoped storage key for a session object.
   *
   * e.g. `organizations/t1/projects/p1/sessions/s1/documents/front.jpg`
   *
   * @param ctx
   * @param sessionId
   * @param parts
   * @returns
   */
  static storagePath(ctx: OrganizationProjectContext, sessionId: Id, ...parts: string[]): string {
    const segments = ['organizations', ctx.organizationId, 'projects', ctx.projectId, 'sessions', sessionId, ...parts]
    return segments.join('/')
  }
}
