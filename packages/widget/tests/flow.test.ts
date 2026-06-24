import { describe, expect, it } from 'vitest'
import type { WorkflowConfig } from '@arkyc/types'
import { Flow } from '../src/flow'

const wf = (steps: WorkflowConfig['steps'], skip_ocr = false): WorkflowConfig => ({ steps, options: { skip_ocr } })

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

describe('Flow workflow ordering', () => {
  it('uses the default step order with no workflow', () => {
    expect(Flow.stepOrder()).toEqual(Flow.STEP_ORDER)
  })

  it('reorders stages — liveness before document', () => {
    const workflow = wf([
      { key: 'liveness', enabled: true },
      { key: 'document', enabled: true },
      { key: 'face_match', enabled: true },
    ])
    const order = Flow.stepOrder({ workflow })
    expect(order.indexOf('selfie_capture')).toBeLessThan(order.indexOf('front_capture'))
    // In passive mode the first screen after welcome is the liveness selfie.
    expect(Flow.nextStep('welcome', { workflow, livenessMode: 'passive' })).toBe('selfie_capture')
  })

  it('drops disabled stages from the order entirely', () => {
    const workflow = wf([
      { key: 'document', enabled: true },
      { key: 'liveness', enabled: false },
      { key: 'face_match', enabled: false },
    ])
    const order = Flow.stepOrder({ workflow })
    expect(order).not.toContain('selfie_capture')
    expect(order).not.toContain('face_match')
    expect(order).toContain('front_capture')
  })

  it('skips ocr_processing when the workflow skips OCR', () => {
    const workflow = wf(
      [
        { key: 'document', enabled: true },
        { key: 'liveness', enabled: false },
        { key: 'face_match', enabled: false },
      ],
      true,
    )
    expect(Flow.isStepEnabled('ocr_processing', { workflow })).toBe(false)
    // Passport front capture, OCR skipped, no later stages → straight to processing.
    expect(Flow.nextStep('front_capture', { workflow, documentType: 'passport' })).toBe('processing')
  })

  it('runs ocr_processing by default', () => {
    expect(Flow.isStepEnabled('ocr_processing')).toBe(true)
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
