import { afterEach, describe, expect, it } from 'vitest';
import type { PermissionKey } from '@arkyc/types';
import {
  Catalogue,
  PermissionDeniedError,
  PermissionRegistry,
  PermissionSync,
  Permissions,
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

describe('Permissions.resolve', () => {
  it('unions and deduplicates across all sources', async () => {
    const store = resolverStore({
      tenantRole: ['sessions.view', 'reviews.view'],
      projectRole: ['sessions.view', 'sessions.create'],
      direct: ['api_keys.view', 'reviews.view'],
    });
    const perms = await Permissions.resolve({ ...CTX, projectId: 'p1' }, store);
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
    const perms = await Permissions.resolve(CTX, store);
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
    const perms = await Permissions.resolve(CTX, store);
    expect(new Set(perms)).toEqual(new Set([...reviewer, 'api_keys.view']));
  });
});

describe('permission checks', () => {
  const perms: PermissionKey[] = ['sessions.view', 'reviews.approve'];

  it('has / hasAny / hasAll', () => {
    expect(Permissions.has(perms, 'sessions.view')).toBe(true);
    expect(Permissions.has(perms, 'api_keys.create')).toBe(false);
    expect(Permissions.has(new Set(perms), 'reviews.approve')).toBe(true);
    expect(Permissions.hasAny(perms, ['api_keys.create', 'reviews.approve'])).toBe(true);
    expect(Permissions.hasAll(perms, ['sessions.view', 'reviews.approve'])).toBe(true);
    expect(Permissions.hasAll(perms, ['sessions.view', 'api_keys.create'])).toBe(false);
  });

  it('ensure throws PermissionDeniedError when missing', () => {
    expect(() => Permissions.ensure(perms, 'sessions.view')).not.toThrow();
    expect(() => Permissions.ensure(perms, 'api_keys.create')).toThrow(PermissionDeniedError);
  });

  it('authorize resolves then allows or denies', async () => {
    const store = resolverStore({ tenantRole: ['sessions.view'] });
    await expect(Permissions.authorize(CTX, 'sessions.view', store)).resolves.toBeUndefined();
    await expect(Permissions.authorize(CTX, 'sessions.cancel', store)).rejects.toBeInstanceOf(
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
  it('PermissionSync.permissions upserts the whole catalogue', async () => {
    const store = new FakeSyncStore();
    await PermissionSync.permissions(store);
    expect(store.permissions).toHaveLength(Catalogue.ALL.length);
    expect(store.permissions.map((p) => p.name)).toContain('sessions.view');
  });

  it('PermissionSync.roles creates the five roles with their grants', async () => {
    const store = new FakeSyncStore();
    await PermissionSync.roles('t1', store);
    expect(store.roles.map((r) => r.slug)).toEqual([
      'owner',
      'admin',
      'reviewer',
      'developer',
      'readonly',
    ]);
    // owner receives the full catalogue
    expect(store.rolePerms.get('t1_role_owner')).toHaveLength(Catalogue.ALL.length);
    // reviewer is scoped
    expect(store.rolePerms.get('t1_role_reviewer')).toContain('reviews.approve');
  });
});

describe('PermissionRegistry.define', () => {
  afterEach(() => PermissionRegistry.clear());

  it('registers custom permissions and exposes them', () => {
    PermissionRegistry.define('exports.schedule', 'exports', 'Schedule exports');
    expect(PermissionRegistry.defined()).toEqual([
      { name: 'exports.schedule', group: 'exports', description: 'Schedule exports' },
    ]);
  });

  it('allKnown merges catalogue with custom (custom wins by name)', () => {
    PermissionRegistry.define('exports.schedule', 'exports', 'Schedule exports');
    const all = PermissionRegistry.allKnown();
    expect(all.length).toBe(Catalogue.ALL.length + 1);
    expect(all.find((p) => p.name === 'exports.schedule')).toBeDefined();
  });
});
