import { PERMISSION_CATALOGUE, type PermissionDefinition } from './catalogue';

/** A custom (consumer-defined) permission. `name`/`group` are free-form strings. */
export interface DefinedPermission {
  name: string;
  group: string;
  description: string;
}

const registry = new Map<string, DefinedPermission>();

/**
 * Register a custom permission beyond the built-in catalogue. Returns the
 * definition. Re-defining the same `name` overwrites the previous entry.
 */
export function definePermission(name: string, group: string, description = ''): DefinedPermission {
  const def: DefinedPermission = { name, group, description };
  registry.set(name, def);
  return def;
}

/** All custom permissions registered via {@link definePermission}. */
export function getDefinedPermissions(): DefinedPermission[] {
  return [...registry.values()];
}

/**
 * The full set of known permissions: the built-in catalogue plus any custom
 * permissions, deduplicated by name (custom definitions win).
 */
export function allKnownPermissions(): DefinedPermission[] {
  const byName = new Map<string, DefinedPermission>();
  for (const def of PERMISSION_CATALOGUE as readonly PermissionDefinition[]) {
    byName.set(def.name, { name: def.name, group: def.group, description: def.description });
  }
  for (const def of registry.values()) {
    byName.set(def.name, def);
  }
  return [...byName.values()];
}

/** Clear the custom permission registry (primarily for tests). */
export function clearDefinedPermissions(): void {
  registry.clear();
}
