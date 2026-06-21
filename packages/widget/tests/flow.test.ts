import { describe, expect, it } from 'vitest';
import { Flow } from '../src/flow';

describe('Flow step machine', () => {
  it('walks the full ordered flow for a two-sided document', () => {
    const visited = ['welcome'];
    let step = 'welcome' as (typeof Flow.STEP_ORDER)[number];
    for (let i = 0; i < Flow.STEP_ORDER.length + 2; i++) {
      const n = Flow.nextStep(step, { documentType: 'id_card' });
      if (n === step) break;
      visited.push(n);
      step = n;
    }
    expect(visited).toEqual(Flow.STEP_ORDER);
  });

  it('skips back_capture for single-sided passports', () => {
    expect(Flow.nextStep('front_capture', { documentType: 'passport' })).toBe('ocr_processing');
    expect(Flow.nextStep('front_capture', { documentType: 'id_card' })).toBe('back_capture');
  });

  it('treats an unknown document type as single-sided', () => {
    expect(Flow.nextStep('front_capture', {})).toBe('ocr_processing');
  });

  it('stays put at the final step', () => {
    expect(Flow.nextStep('result', { documentType: 'id_card' })).toBe('result');
  });

  it('knows which documents have a back', () => {
    expect(Flow.documentHasBack('passport')).toBe(false);
    expect(Flow.documentHasBack('id_card')).toBe(true);
    expect(Flow.documentHasBack(null)).toBe(false);
  });
});

describe('Flow terminal-status helpers', () => {
  it('detects terminal statuses', () => {
    expect(Flow.isTerminal('approved')).toBe(true);
    expect(Flow.isTerminal('requires_review')).toBe(true);
    expect(Flow.isTerminal('expired')).toBe(true);
    expect(Flow.isTerminal('processing')).toBe(false);
    expect(Flow.isTerminal('started')).toBe(false);
  });

  it('maps statuses to decisions', () => {
    expect(Flow.statusToDecision('approved')).toBe('approved');
    expect(Flow.statusToDecision('rejected')).toBe('rejected');
    expect(Flow.statusToDecision('requires_review')).toBe('requires_review');
    expect(Flow.statusToDecision('expired')).toBeNull();
    expect(Flow.statusToDecision('processing')).toBeNull();
  });
});
