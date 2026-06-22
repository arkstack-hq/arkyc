import type { AdminPermissionKey, PermissionKey } from '@arkyc/types'
import {
  PermissionDeniedError,
  type AdminResolutionContext,
  type AdminResolverStore,
  type PermissionResolutionContext,
  type PermissionResolverStore,
} from './types'

/** A resolved set of permissions, as an array or a Set. */
export type PermissionSet = Iterable<PermissionKey>

/** Resolution of effective permissions and checks against a resolved set. */
export class Permissions {
  private static toSet(permissions: PermissionSet): Set<PermissionKey> {
    return permissions instanceof Set ? permissions : new Set(permissions)
  }

  /** Deduplicate permission keys, preserving first-seen order. */
  static dedupe(permissions: Iterable<PermissionKey>): PermissionKey[] {
    return [...new Set(permissions)]
  }

  /**
   * Resolve the effective permission set for a user within a tenant (and,
   * optionally, a project).
   *
   * The result is the deduplicated union of:
   *   - permissions from the tenant role
   *   - permissions from the project role (only when `projectId` is set)
   *   - direct tenant-level user permissions
   *   - direct project-level user permissions
   *
   * i.e. `effective_permissions = role_permissions + direct_user_permissions`.
   *
   * @param ctx
   * @param store
   * @returns
   */
  static async resolve(ctx: PermissionResolutionContext, store: PermissionResolverStore): Promise<PermissionKey[]> {
    const [tenantRole, projectRole, direct] = await Promise.all([
      store.tenantRolePermissions(ctx),
      ctx.projectId ? store.projectRolePermissions(ctx) : Promise.resolve([] as PermissionKey[]),
      store.directPermissions(ctx),
    ])

    return Permissions.dedupe([...tenantRole, ...projectRole, ...direct])
  }

  /**
   * Whether `permissions` includes the `required` permission.
   *
   * @param permissions
   * @param required
   * @returns
   */
  static has(permissions: PermissionSet, required: PermissionKey): boolean {
    return Permissions.toSet(permissions).has(required)
  }

  /**
   * Whether `permissions` includes at least one of the `required` permissions.
   *
   * @param permissions
   * @param required
   * @returns
   */
  static hasAny(permissions: PermissionSet, required: readonly PermissionKey[]): boolean {
    const set = Permissions.toSet(permissions)
    return required.some((p) => set.has(p))
  }

  /**
   * Whether `permissions` includes every one of the `required` permissions.
   *
   * @param permissions
   * @param required
   * @returns
   */
  static hasAll(permissions: PermissionSet, required: readonly PermissionKey[]): boolean {
    const set = Permissions.toSet(permissions)
    return required.every((p) => set.has(p))
  }

  /**
   * Assert that an already-resolved permission set contains `required`, throwing
   * {@link PermissionDeniedError} otherwise. Use this in hot paths where the set
   * was resolved once per request.
   *
   * @param permissions
   * @param required
   */
  static ensure(permissions: PermissionSet, required: PermissionKey): void {
    if (!Permissions.has(permissions, required)) {
      throw new PermissionDeniedError(required)
    }
  }

  /**
   * Resolve the user's effective permissions for the context and assert they
   * include `required`, throwing {@link PermissionDeniedError} otherwise.
   *
   * e.g. `await Permissions.authorize({ userId, tenantId }, 'sessions.view', store)`.
   *
   * @param ctx
   * @param required
   * @param store
   */
  static async authorize(
    ctx: PermissionResolutionContext,
    required: PermissionKey,
    store: PermissionResolverStore,
  ): Promise<void> {
    const permissions = await Permissions.resolve(ctx, store)
    Permissions.ensure(permissions, required)
  }

  /**
   * Resolve a user's effective platform-admin permission set: the deduplicated
   * union of their admin role permissions and direct admin grants. This is an
   * entirely separate path from tenant {@link resolve} — a tenant role can never
   * contribute admin access.
   *
   * @param ctx
   * @param store
   * @returns
   */
  static async resolveAdmin(ctx: AdminResolutionContext, store: AdminResolverStore): Promise<AdminPermissionKey[]> {
    const [role, direct] = await Promise.all([store.adminRolePermissions(ctx), store.adminDirectPermissions(ctx)])

    return [...new Set([...role, ...direct])]
  }

  /**
   * Resolve the user's effective admin permissions and assert they include
   * `required`, throwing {@link PermissionDeniedError} otherwise.
   *
   * @param ctx
   * @param required
   * @param store
   */
  static async authorizeAdmin(
    ctx: AdminResolutionContext,
    required: AdminPermissionKey,
    store: AdminResolverStore,
  ): Promise<void> {
    const permissions = await Permissions.resolveAdmin(ctx, store)
    if (!new Set(permissions).has(required)) {
      throw new PermissionDeniedError(required)
    }
  }
}
