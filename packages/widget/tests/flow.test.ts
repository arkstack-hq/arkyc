import { describe, expect, it } from 'vitest'
import { Flow } from '../src/flow'

describe('Flow step machine', () => {
  const walk = (ctx: Parameters<typeof Flow.nextStep>[1]): string[] => {
    const visited = ['welcome']
    let step = 'welcome' as (typeof Flow.STEP_ORDER)[number]
    for (let i = 0; i < Flow.STEP_ORDER.length + 2; i++) {
      const n = Flow.nextStep(step, ctx)
      if (n === step) break
      visited.push(n)
      step = n
    }
    return visited
  }

  it('walks the passive two-sided flow (selfie + passive liveness)', () => {
    expect(walk({ documentType: 'id_card', livenessMode: 'passive' })).toEqual([
      'welcome',
      'document_selection',
      'front_capture',
      'back_capture',
      'ocr_processing',
      'selfie_capture',
      'passive_liveness',
      'face_match',
      'processing',
      'result',
    ])
  })

  it('walks the active two-sided flow (active liveness, no selfie)', () => {
    expect(walk({ documentType: 'id_card', livenessMode: 'active' })).toEqual([
      'welcome',
      'document_selection',
      'front_capture',
      'back_capture',
      'ocr_processing',
      'active_liveness',
      'face_match',
      'processing',
      'result',
    ])
  })

  it('skips back_capture for single-sided passports', () => {
    expect(Flow.nextStep('front_capture', { documentType: 'passport' })).toBe('ocr_processing')
    expect(Flow.nextStep('front_capture', { documentType: 'id_card' })).toBe('back_capture')
  })

  it('treats an unknown document type as single-sided', () => {
    expect(Flow.nextStep('front_capture', {})).toBe('ocr_processing')
  })

  it('stays put at the final step', () => {
    expect(Flow.nextStep('result', { documentType: 'id_card' })).toBe('result')
  })

  it('knows which documents have a back', () => {
    expect(Flow.documentHasBack('passport')).toBe(false)
    expect(Flow.documentHasBack('id_card')).toBe(true)
    expect(Flow.documentHasBack(null)).toBe(false)
  })
})

describe('Flow terminal-status helpers', () => {
  it('detects terminal statuses', () => {
    expect(Flow.isTerminal('approved')).toBe(true)
    expect(Flow.isTerminal('requires_review')).toBe(true)
    expect(Flow.isTerminal('expired')).toBe(true)
    expect(Flow.isTerminal('processing')).toBe(false)
    expect(Flow.isTerminal('started')).toBe(false)
  })

  it('maps statuses to decisions', () => {
    expect(Flow.statusToDecision('approved')).toBe('approved')
    expect(Flow.statusToDecision('rejected')).toBe('rejected')
    expect(Flow.statusToDecision('requires_review')).toBe('requires_review')
    expect(Flow.statusToDecision('expired')).toBeNull()
    expect(Flow.statusToDecision('processing')).toBeNull()
  })
})
