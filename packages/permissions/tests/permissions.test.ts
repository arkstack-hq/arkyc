import { Catalogue, DefaultRoles } from '../src/index'
import { describe, expect, it } from 'vitest'

describe('permission catalogue', () => {
  it('has unique permission names', () => {
    const names = Catalogue.ALL.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('derives Catalogue.KEYS from the catalogue', () => {
    expect(Catalogue.KEYS).toHaveLength(Catalogue.ALL.length)
    expect(Catalogue.KEYS).toContain('sessions.view')
    expect(Catalogue.KEYS).toContain('billing.update')
  })
})

describe('default roles', () => {
  it('owner receives every permission', () => {
    expect(DefaultRoles.bySlug('owner').permissions).toHaveLength(Catalogue.KEYS.length)
  })

  it('admin excludes the most destructive/owner-only actions', () => {
    const admin = DefaultRoles.bySlug('admin').permissions
    expect(admin).not.toContain('tenants.delete')
    expect(admin).not.toContain('billing.update')
    expect(admin).toContain('projects.create')
  })

  it('reviewer is scoped to sessions/reviews', () => {
    const reviewer = DefaultRoles.bySlug('reviewer').permissions
    expect(reviewer).toContain('reviews.approve')
    expect(reviewer).not.toContain('api_keys.create')
  })

  it('readonly is view-only', () => {
    expect(DefaultRoles.bySlug('readonly').permissions.every((p) => p.endsWith('.view'))).toBe(true)
  })

  it('seeds the five system roles', () => {
    expect(DefaultRoles.ALL.map((r) => r.slug)).toEqual([
      'owner',
      'admin',
      'reviewer',
      'developer',
      'readonly',
    ])
  })

  it('throws for an unknown role', () => {
    expect(() => DefaultRoles.bySlug('superuser')).toThrow()
  })
})
