import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLES,
  PERMISSION_CATALOGUE,
  defaultRole,
} from '../src/index';
import { describe, expect, it } from 'vitest';

describe('permission catalogue', () => {
  it('has unique permission names', () => {
    const names = PERMISSION_CATALOGUE.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('derives ALL_PERMISSION_KEYS from the catalogue', () => {
    expect(ALL_PERMISSION_KEYS).toHaveLength(PERMISSION_CATALOGUE.length);
    expect(ALL_PERMISSION_KEYS).toContain('sessions.view');
    expect(ALL_PERMISSION_KEYS).toContain('billing.update');
  });
});

describe('default roles', () => {
  it('owner receives every permission', () => {
    expect(defaultRole('owner').permissions).toHaveLength(ALL_PERMISSION_KEYS.length);
  });

  it('admin excludes the most destructive/owner-only actions', () => {
    const admin = defaultRole('admin').permissions;
    expect(admin).not.toContain('tenants.delete');
    expect(admin).not.toContain('billing.update');
    expect(admin).toContain('projects.create');
  });

  it('reviewer is scoped to sessions/reviews', () => {
    const reviewer = defaultRole('reviewer').permissions;
    expect(reviewer).toContain('reviews.approve');
    expect(reviewer).not.toContain('api_keys.create');
  });

  it('readonly is view-only', () => {
    expect(defaultRole('readonly').permissions.every((p) => p.endsWith('.view'))).toBe(true);
  });

  it('seeds the five system roles', () => {
    expect(DEFAULT_ROLES.map((r) => r.slug)).toEqual([
      'owner',
      'admin',
      'reviewer',
      'developer',
      'readonly',
    ]);
  });

  it('throws for an unknown role', () => {
    expect(() => defaultRole('superuser')).toThrow();
  });
});
