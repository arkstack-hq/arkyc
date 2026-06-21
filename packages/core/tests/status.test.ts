import { describe, expect, it } from 'vitest'
import type { VerificationStatus } from '@arkyc/types'
import { InvalidStatusTransitionError, StatusMachine } from '../src/index'

describe('status transitions', () => {
  it('allows the happy-path progression', () => {
    const path: VerificationStatus[] = [
      'pending',
      'started',
      'document_submitted',
      'liveness_submitted',
      'processing',
      'approved',
    ]
    for (let i = 0; i < path.length - 1; i++) {
      expect(StatusMachine.canTransition(path[i]!, path[i + 1]!)).toBe(true)
    }
  })

  it('rejects illegal transitions', () => {
    expect(StatusMachine.canTransition('pending', 'approved')).toBe(false)
    expect(StatusMachine.canTransition('approved', 'pending')).toBe(false)
    expect(StatusMachine.canTransition('processing', 'document_submitted')).toBe(false)
  })

  it('treats decision and lifecycle-end states as terminal', () => {
    for (const s of StatusMachine.TERMINAL) {
      expect(StatusMachine.isTerminal(s)).toBe(true)
      expect(StatusMachine.TRANSITIONS[s]).toEqual([])
    }
    expect(StatusMachine.isTerminal('processing')).toBe(false)
  })

  it('allows requires_review to resolve or loop back for retry', () => {
    expect(StatusMachine.canTransition('requires_review', 'approved')).toBe(true)
    expect(StatusMachine.canTransition('requires_review', 'rejected')).toBe(true)
    expect(StatusMachine.canTransition('requires_review', 'started')).toBe(true)
  })

  it('can expire or cancel from any non-terminal state', () => {
    const nonTerminal: VerificationStatus[] = [
      'pending',
      'started',
      'document_submitted',
      'liveness_submitted',
      'processing',
    ]
    for (const s of nonTerminal) {
      expect(StatusMachine.canTransition(s, 'expired')).toBe(true)
      expect(StatusMachine.canTransition(s, 'cancelled')).toBe(true)
    }
  })

  it('StatusMachine.assert returns the target or throws', () => {
    expect(StatusMachine.assert('pending', 'started')).toBe('started')
    expect(() => StatusMachine.assert('pending', 'approved')).toThrow(InvalidStatusTransitionError)
  })
})
