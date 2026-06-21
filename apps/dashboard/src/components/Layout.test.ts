import { describe, expect, it } from 'vitest'
import type { PermissionKey } from '@arkyc/types'
import { visibleNavItems } from './Layout'

const canFor = (perms: PermissionKey[]) => {
  const set = new Set(perms)
  return (perm: PermissionKey) => set.has(perm)
}

describe('permission-aware navigation', () => {
  it('shows every section to an owner (all permissions)', () => {
    const labels = visibleNavItems(() => true).map((i) => i.label)
    expect(labels).toEqual([
      'Overview',
      'Sessions',
      'Reviews',
      'Projects',
      'Members',
      'Audit Logs',
      'Settings',
    ])
  })

  it('limits a reviewer to overview + session/review sections', () => {
    // Default `reviewer` role: sessions.view + reviews.*
    const reviewer = canFor([
      'sessions.view',
      'reviews.view',
      'reviews.approve',
      'reviews.reject',
    ])
    const labels = visibleNavItems(reviewer).map((i) => i.label)
    expect(labels).toEqual(['Overview', 'Sessions', 'Reviews'])
    expect(labels).not.toContain('Members')
    expect(labels).not.toContain('Settings')
  })

  it('always shows Overview even with no permissions', () => {
    expect(visibleNavItems(() => false).map((i) => i.label)).toEqual(['Overview'])
  })
})
