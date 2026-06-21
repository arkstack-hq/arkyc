import { Catalogue, type PermissionDefinition } from './catalogue';

/** A custom (consumer-defined) permission. `name`/`group` are free-form strings. */
export interface DefinedPermission {
  name: string;
  group: string;
  description: string;
}

/** Registry of custom permissions beyond the built-in catalogue. */
export class PermissionRegistry {
  private static registry = new Map<string, DefinedPermission>();

  /**
   * Register a custom permission beyond the built-in catalogue. Returns the
   * definition. Re-defining the same `name` overwrites the previous entry.
   */
  static define(name: string, group: string, description = ''): DefinedPermission {
    const def: DefinedPermission = { name, group, description };
    PermissionRegistry.registry.set(name, def);
    return def;
  }

  /** All custom permissions registered via {@link PermissionRegistry.define}. */
  static defined(): DefinedPermission[] {
    return [...PermissionRegistry.registry.values()];
  }

  /**
   * The full set of known permissions: the built-in catalogue plus any custom
   * permissions, deduplicated by name (custom definitions win).
   */
  static allKnown(): DefinedPermission[] {
    const byName = new Map<string, DefinedPermission>();
    for (const def of Catalogue.ALL as readonly PermissionDefinition[]) {
      byName.set(def.name, { name: def.name, group: def.group, description: def.description });
    }
    for (const def of PermissionRegistry.registry.values()) {
      byName.set(def.name, def);
    }
    return [...byName.values()];
  }

  /** Clear the custom permission registry (primarily for tests). */
  static clear(): void {
    PermissionRegistry.registry.clear();
  }
}
