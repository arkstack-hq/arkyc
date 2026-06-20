import type { PermissionKey } from '@arkyc/types';
import { resolvePermissions } from './resolve';
import {
  PermissionDeniedError,
  type PermissionResolutionContext,
  type PermissionResolverStore,
} from './types';

/** A resolved set of permissions, as an array or a Set. */
export type PermissionSet = Iterable<PermissionKey>;

function toSet(permissions: PermissionSet): Set<PermissionKey> {
  return permissions instanceof Set ? permissions : new Set(permissions);
}

/** Whether `permissions` includes the `required` permission. */
export function hasPermission(permissions: PermissionSet, required: PermissionKey): boolean {
  return toSet(permissions).has(required);
}

/** Whether `permissions` includes at least one of the `required` permissions. */
export function hasAnyPermission(
  permissions: PermissionSet,
  required: readonly PermissionKey[],
): boolean {
  const set = toSet(permissions);
  return required.some((p) => set.has(p));
}

/** Whether `permissions` includes every one of the `required` permissions. */
export function hasAllPermissions(
  permissions: PermissionSet,
  required: readonly PermissionKey[],
): boolean {
  const set = toSet(permissions);
  return required.every((p) => set.has(p));
}

/**
 * Assert that an already-resolved permission set contains `required`, throwing
 * {@link PermissionDeniedError} otherwise. Use this in hot paths where the set
 * was resolved once per request.
 */
export function ensurePermission(permissions: PermissionSet, required: PermissionKey): void {
  if (!hasPermission(permissions, required)) {
    throw new PermissionDeniedError(required);
  }
}

/**
 * Resolve the user's effective permissions for the context and assert they
 * include `required`, throwing {@link PermissionDeniedError} otherwise.
 *
 * e.g. `await authorize({ userId, tenantId }, 'sessions.view', store)`.
 */
export async function authorize(
  ctx: PermissionResolutionContext,
  required: PermissionKey,
  store: PermissionResolverStore,
): Promise<void> {
  const permissions = await resolvePermissions(ctx, store);
  ensurePermission(permissions, required);
}
