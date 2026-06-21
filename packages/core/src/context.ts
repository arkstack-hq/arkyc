import type { Id, TenantScoped } from '@arkyc/types';

/** Identifies the tenant + project a request or entity belongs to. */
export interface TenantProjectContext {
  tenantId: Id;
  projectId: Id;
}

/**
 * Thrown when an entity is accessed outside its tenant/project scope.
 */
export class TenantScopeError extends Error {
  constructor(message = 'Entity is outside the active tenant scope') {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/** Tenant/project scoping and storage-path helpers. */
export class TenantContext {
  /**
   * Whether `entity` belongs to the given tenant.
   *
   * @param entity
   * @param tenantId
   * @returns
   */
  static belongsTo(entity: TenantScoped, tenantId: Id): boolean {
    return entity.tenant_id === tenantId;
  }

  /**
   * Assert that `entity` belongs to `tenantId`, throwing {@link TenantScopeError}
   * otherwise. Returns the entity (narrowed) for inline use.
   *
   * @param entity
   * @param tenantId
   * @returns
   */
  static assertScope<T extends TenantScoped>(entity: T, tenantId: Id): T {
    if (!TenantContext.belongsTo(entity, tenantId)) {
      throw new TenantScopeError();
    }
    return entity;
  }

  /**
   * Build the canonical, tenant/project-scoped storage key for a session object.
   *
   * e.g. `tenants/t1/projects/p1/sessions/s1/documents/front.jpg`
   *
   * @param ctx
   * @param sessionId
   * @param parts
   * @returns
   */
  static storagePath(ctx: TenantProjectContext, sessionId: Id, ...parts: string[]): string {
    const segments = [
      'tenants',
      ctx.tenantId,
      'projects',
      ctx.projectId,
      'sessions',
      sessionId,
      ...parts,
    ];
    return segments.join('/');
  }
}
