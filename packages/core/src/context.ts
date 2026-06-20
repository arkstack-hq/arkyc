import type { Id, TenantScoped } from '@arkyc/types';

/** Identifies the tenant + project a request or entity belongs to. */
export interface TenantProjectContext {
  tenantId: Id;
  projectId: Id;
}

/** Thrown when an entity is accessed outside its tenant/project scope. */
export class TenantScopeError extends Error {
  constructor(message = 'Entity is outside the active tenant scope') {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/** Whether `entity` belongs to the given tenant. */
export function belongsToTenant(entity: TenantScoped, tenantId: Id): boolean {
  return entity.tenant_id === tenantId;
}

/**
 * Assert that `entity` belongs to `tenantId`, throwing {@link TenantScopeError}
 * otherwise. Returns the entity (narrowed) for inline use.
 */
export function assertTenantScope<T extends TenantScoped>(entity: T, tenantId: Id): T {
  if (!belongsToTenant(entity, tenantId)) {
    throw new TenantScopeError();
  }
  return entity;
}

/**
 * Build the canonical, tenant/project-scoped storage key for a session object.
 *
 * e.g. `tenants/t1/projects/p1/sessions/s1/documents/front.jpg`
 */
export function buildSessionStoragePath(
  ctx: TenantProjectContext,
  sessionId: Id,
  ...parts: string[]
): string {
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
