import { describe, expect, it } from 'vitest';
import type { VerificationStatus } from '@arkyc/types';
import {
  InvalidStatusTransitionError,
  STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
  assertTransition,
  canTransition,
  isTerminalStatus,
} from '../src/index';

describe('status transitions', () => {
  it('allows the happy-path progression', () => {
    const path: VerificationStatus[] = [
      'pending',
      'started',
      'document_submitted',
      'liveness_submitted',
      'processing',
      'approved',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('pending', 'approved')).toBe(false);
    expect(canTransition('approved', 'pending')).toBe(false);
    expect(canTransition('processing', 'document_submitted')).toBe(false);
  });

  it('treats decision and lifecycle-end states as terminal', () => {
    for (const s of TERMINAL_STATUSES) {
      expect(isTerminalStatus(s)).toBe(true);
      expect(STATUS_TRANSITIONS[s]).toEqual([]);
    }
    expect(isTerminalStatus('processing')).toBe(false);
  });

  it('allows requires_review to resolve or loop back for retry', () => {
    expect(canTransition('requires_review', 'approved')).toBe(true);
    expect(canTransition('requires_review', 'rejected')).toBe(true);
    expect(canTransition('requires_review', 'started')).toBe(true);
  });

  it('can expire or cancel from any non-terminal state', () => {
    const nonTerminal: VerificationStatus[] = [
      'pending',
      'started',
      'document_submitted',
      'liveness_submitted',
      'processing',
    ];
    for (const s of nonTerminal) {
      expect(canTransition(s, 'expired')).toBe(true);
      expect(canTransition(s, 'cancelled')).toBe(true);
    }
  });

  it('assertTransition returns the target or throws', () => {
    expect(assertTransition('pending', 'started')).toBe('started');
    expect(() => assertTransition('pending', 'approved')).toThrow(InvalidStatusTransitionError);
  });
});
