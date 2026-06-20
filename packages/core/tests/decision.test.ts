import { describe, expect, it } from 'vitest';
import type { DecisionReason, VerificationDecision } from '@arkyc/types';
import {
  DEFAULT_THRESHOLDS,
  decideVerification,
  resolveThresholds,
  type DecisionInput,
} from '../src/index.js';

/** A session where every signal comfortably clears its threshold. */
function goodInput(): DecisionInput {
  return {
    document: { qualityScore: 0.9, ocrConfidence: 0.92, expired: false },
    liveness: { passed: true, score: 0.95, multipleFaces: false },
    faceMatch: { passed: true, similarityScore: 0.85 },
  };
}

describe('decideVerification', () => {
  interface Case {
    name: string;
    mutate: (i: DecisionInput) => void;
    decision: VerificationDecision;
    reason: DecisionReason;
  }

  const cases: Case[] = [
    {
      name: 'auto-approves when everything passes',
      mutate: () => {},
      decision: 'approved',
      reason: 'AUTO_APPROVED',
    },
    {
      name: 'rejects an expired document',
      mutate: (i) => {
        i.document.expired = true;
      },
      decision: 'rejected',
      reason: 'DOCUMENT_EXPIRED',
    },
    {
      name: 'rejects failed liveness',
      mutate: (i) => {
        i.liveness.passed = false;
      },
      decision: 'rejected',
      reason: 'LIVENESS_FAILED',
    },
    {
      name: 'rejects failed face match',
      mutate: (i) => {
        i.faceMatch.passed = false;
      },
      decision: 'rejected',
      reason: 'FACE_MATCH_FAILED',
    },
    {
      name: 'reviews multiple faces',
      mutate: (i) => {
        i.liveness.multipleFaces = true;
      },
      decision: 'requires_review',
      reason: 'MULTIPLE_FACES_DETECTED',
    },
    {
      name: 'reviews low document quality',
      mutate: (i) => {
        i.document.qualityScore = 0.5;
      },
      decision: 'requires_review',
      reason: 'LOW_DOCUMENT_QUALITY',
    },
    {
      name: 'reviews low OCR confidence',
      mutate: (i) => {
        i.document.ocrConfidence = 0.4;
      },
      decision: 'requires_review',
      reason: 'OCR_LOW_CONFIDENCE',
    },
    {
      name: 'reviews low liveness confidence',
      mutate: (i) => {
        i.liveness.score = 0.6;
      },
      decision: 'requires_review',
      reason: 'LIVENESS_LOW_CONFIDENCE',
    },
    {
      name: 'reviews low face-match confidence',
      mutate: (i) => {
        i.faceMatch.similarityScore = 0.5;
      },
      decision: 'requires_review',
      reason: 'FACE_MATCH_LOW_CONFIDENCE',
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const input = goodInput();
      c.mutate(input);
      const result = decideVerification(input);
      expect(result.decision).toBe(c.decision);
      expect(result.reason).toBe(c.reason);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
    });
  }

  it('treats a score exactly at threshold as passing (>=)', () => {
    const input = goodInput();
    input.document.qualityScore = DEFAULT_THRESHOLDS.documentQualityThreshold;
    input.document.ocrConfidence = DEFAULT_THRESHOLDS.ocrConfidenceThreshold;
    input.liveness.score = DEFAULT_THRESHOLDS.livenessThreshold;
    input.faceMatch.similarityScore = DEFAULT_THRESHOLDS.faceMatchThreshold;
    expect(decideVerification(input).reason).toBe('AUTO_APPROVED');
  });

  it('gives hard rejection precedence over review signals', () => {
    const input = goodInput();
    input.document.expired = true; // reject signal
    input.liveness.multipleFaces = true; // review signal
    input.document.qualityScore = 0.1; // review signal
    expect(decideVerification(input).reason).toBe('DOCUMENT_EXPIRED');
  });

  it('orders reject reasons: expired before liveness before face match', () => {
    const input = goodInput();
    input.liveness.passed = false;
    input.faceMatch.passed = false;
    expect(decideVerification(input).reason).toBe('LIVENESS_FAILED');
  });

  it('honours per-project threshold overrides', () => {
    const input = goodInput();
    input.faceMatch.similarityScore = 0.8;
    // Default face-match threshold is 0.75 → would approve.
    expect(decideVerification(input).reason).toBe('AUTO_APPROVED');
    // Raise the bar to 0.9 → now routed to review.
    const result = decideVerification(input, { faceMatchThreshold: 0.9 });
    expect(result.decision).toBe('requires_review');
    expect(result.reason).toBe('FACE_MATCH_LOW_CONFIDENCE');
  });
});

describe('resolveThresholds', () => {
  it('returns defaults when no overrides given', () => {
    expect(resolveThresholds()).toEqual(DEFAULT_THRESHOLDS);
  });

  it('merges a partial override over defaults', () => {
    const merged = resolveThresholds({ livenessThreshold: 0.99 });
    expect(merged.livenessThreshold).toBe(0.99);
    expect(merged.ocrConfidenceThreshold).toBe(DEFAULT_THRESHOLDS.ocrConfidenceThreshold);
  });
});
