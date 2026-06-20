import { afterEach, describe, expect, it } from 'vitest';
import type { PermissionKey } from '@arkyc/types';
import {
  allKnownPermissions,
  authorize,
  clearDefinedPermissions,
  definePermission,
  ensurePermission,
  getDefinedPermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  PERMISSION_CATALOGUE,
  PermissionDeniedError,
  resolvePermissions,
  syncDefaultPermissions,
  syncDefaultRoles,
  type PermissionDefinition,
  type PermissionResolutionContext,
  type PermissionResolverStore,
  type PermissionSyncStore,
} from '../src/index';

function resolverStore(data: {
  tenantRole?: PermissionKey[];
  projectRole?: PermissionKey[];
  direct?: PermissionKey[];
}): PermissionResolverStore {
  return {
    tenantRolePermissions: async () => data.tenantRole ?? [],
    projectRolePermissions: async () => data.projectRole ?? [],
    directPermissions: async () => data.direct ?? [],
  };
}

const CTX: PermissionResolutionContext = { userId: 'u1', tenantId: 't1' };

describe('resolvePermissions', () => {
  it('unions and deduplicates across all sources', async () => {
    const store = resolverStore({
      tenantRole: ['sessions.view', 'reviews.view'],
      projectRole: ['sessions.view', 'sessions.create'],
      direct: ['api_keys.view', 'reviews.view'],
    });
    const perms = await resolvePermissions({ ...CTX, projectId: 'p1' }, store);
    expect(perms.sort()).toEqual(
      ['api_keys.view', 'reviews.view', 'sessions.create', 'sessions.view'].sort(),
    );
    // deduplicated
    expect(perms.length).toBe(new Set(perms).size);
  });

  it('ignores project role permissions when no projectId is given', async () => {
    const store = resolverStore({
      tenantRole: ['sessions.view'],
      projectRole: ['settings.update'],
      direct: [],
    });
    const perms = await resolvePermissions(CTX, store);
    expect(perms).toEqual(['sessions.view']);
    expect(perms).not.toContain('settings.update');
  });

  it('resolves the spec example (Jane the reviewer + direct api_keys.view)', async () => {
    const reviewer: PermissionKey[] = [
      'sessions.view',
      'reviews.view',
      'reviews.approve',
      'reviews.reject',
      'reviews.request_retry',
    ];
    const store = resolverStore({ tenantRole: reviewer, direct: ['api_keys.view'] });
    const perms = await resolvePermissions(CTX, store);
    expect(new Set(perms)).toEqual(new Set([...reviewer, 'api_keys.view']));
  });
});

describe('permission checks', () => {
  const perms: PermissionKey[] = ['sessions.view', 'reviews.approve'];

  it('hasPermission / hasAny / hasAll', () => {
    expect(hasPermission(perms, 'sessions.view')).toBe(true);
    expect(hasPermission(perms, 'api_keys.create')).toBe(false);
    expect(hasPermission(new Set(perms), 'reviews.approve')).toBe(true);
    expect(hasAnyPermission(perms, ['api_keys.create', 'reviews.approve'])).toBe(true);
    expect(hasAllPermissions(perms, ['sessions.view', 'reviews.approve'])).toBe(true);
    expect(hasAllPermissions(perms, ['sessions.view', 'api_keys.create'])).toBe(false);
  });

  it('ensurePermission throws PermissionDeniedError when missing', () => {
    expect(() => ensurePermission(perms, 'sessions.view')).not.toThrow();
    expect(() => ensurePermission(perms, 'api_keys.create')).toThrow(PermissionDeniedError);
  });

  it('authorize resolves then allows or denies', async () => {
    const store = resolverStore({ tenantRole: ['sessions.view'] });
    await expect(authorize(CTX, 'sessions.view', store)).resolves.toBeUndefined();
    await expect(authorize(CTX, 'sessions.cancel', store)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
});

class FakeSyncStore implements PermissionSyncStore {
  permissions: PermissionDefinition[] = [];
  roles: { tenantId: string; slug: string; id: string }[] = [];
  rolePerms = new Map<string, readonly PermissionKey[]>();

  async upsertPermission(def: PermissionDefinition): Promise<void> {
    this.permissions.push(def);
  }
  async upsertSystemRole(
    tenantId: string,
    role: { slug: string },
  ): Promise<string> {
    const id = `${tenantId}_role_${role.slug}`;
    this.roles.push({ tenantId, slug: role.slug, id });
    return id;
  }
  async syncRolePermissions(roleId: string, permissions: readonly PermissionKey[]): Promise<void> {
    this.rolePerms.set(roleId, permissions);
  }
}

describe('sync', () => {
  it('syncDefaultPermissions upserts the whole catalogue', async () => {
    const store = new FakeSyncStore();
    await syncDefaultPermissions(store);
    expect(store.permissions).toHaveLength(PERMISSION_CATALOGUE.length);
    expect(store.permissions.map((p) => p.name)).toContain('sessions.view');
  });

  it('syncDefaultRoles creates the five roles with their grants', async () => {
    const store = new FakeSyncStore();
    await syncDefaultRoles('t1', store);
    expect(store.roles.map((r) => r.slug)).toEqual([
      'owner',
      'admin',
      'reviewer',
      'developer',
      'readonly',
    ]);
    // owner receives the full catalogue
    expect(store.rolePerms.get('t1_role_owner')).toHaveLength(PERMISSION_CATALOGUE.length);
    // reviewer is scoped
    expect(store.rolePerms.get('t1_role_reviewer')).toContain('reviews.approve');
  });
});

describe('definePermission', () => {
  afterEach(() => clearDefinedPermissions());

  it('registers custom permissions and exposes them', () => {
    definePermission('exports.schedule', 'exports', 'Schedule exports');
    expect(getDefinedPermissions()).toEqual([
      { name: 'exports.schedule', group: 'exports', description: 'Schedule exports' },
    ]);
  });

  it('allKnownPermissions merges catalogue with custom (custom wins by name)', () => {
    definePermission('exports.schedule', 'exports', 'Schedule exports');
    const all = allKnownPermissions();
    expect(all.length).toBe(PERMISSION_CATALOGUE.length + 1);
    expect(all.find((p) => p.name === 'exports.schedule')).toBeDefined();
  });
});
