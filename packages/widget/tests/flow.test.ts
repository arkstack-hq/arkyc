import { describe, expect, it } from 'vitest';
import {
  STEP_ORDER,
  documentHasBack,
  isTerminal,
  nextStep,
  statusToDecision,
} from '../src/flow';

describe('flow step machine', () => {
  it('walks the full ordered flow for a two-sided document', () => {
    const visited = ['welcome'];
    let step = 'welcome' as (typeof STEP_ORDER)[number];
    for (let i = 0; i < STEP_ORDER.length + 2; i++) {
      const n = nextStep(step, { documentType: 'id_card' });
      if (n === step) break;
      visited.push(n);
      step = n;
    }
    expect(visited).toEqual(STEP_ORDER);
  });

  it('skips back_capture for single-sided passports', () => {
    expect(nextStep('front_capture', { documentType: 'passport' })).toBe('ocr_processing');
    expect(nextStep('front_capture', { documentType: 'id_card' })).toBe('back_capture');
  });

  it('treats an unknown document type as single-sided', () => {
    expect(nextStep('front_capture', {})).toBe('ocr_processing');
  });

  it('stays put at the final step', () => {
    expect(nextStep('result', { documentType: 'id_card' })).toBe('result');
  });

  it('knows which documents have a back', () => {
    expect(documentHasBack('passport')).toBe(false);
    expect(documentHasBack('id_card')).toBe(true);
    expect(documentHasBack(null)).toBe(false);
  });
});

describe('terminal status helpers', () => {
  it('detects terminal statuses', () => {
    expect(isTerminal('approved')).toBe(true);
    expect(isTerminal('requires_review')).toBe(true);
    expect(isTerminal('expired')).toBe(true);
    expect(isTerminal('processing')).toBe(false);
    expect(isTerminal('started')).toBe(false);
  });

  it('maps statuses to decisions', () => {
    expect(statusToDecision('approved')).toBe('approved');
    expect(statusToDecision('rejected')).toBe('rejected');
    expect(statusToDecision('requires_review')).toBe('requires_review');
    expect(statusToDecision('expired')).toBeNull();
    expect(statusToDecision('processing')).toBeNull();
  });
});
