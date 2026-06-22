import { describe, expect, it } from 'vitest'
import type { FaceMatchResultData, LivenessResultData, OcrResultData } from '@arkyc/types'
import { Normalize, Risk, SessionRules, TenantContext, TenantScopeError, type SessionSignals } from '../src/index'

const NOW = '2026-06-20T00:00:00.000Z'

describe('session + document expiry', () => {
  it('detects an expired session', () => {
    expect(SessionRules.isSessionExpired('2026-06-19T23:59:59.000Z', NOW)).toBe(true)
    expect(SessionRules.isSessionExpired('2026-06-20T00:01:00.000Z', NOW)).toBe(false)
  })

  it('treats document expiry as end-of-day and tolerates unknown dates', () => {
    expect(SessionRules.isDocumentExpired('2026-06-19', NOW)).toBe(true)
    expect(SessionRules.isDocumentExpired('2026-06-20', NOW)).toBe(false) // still valid on expiry day
    expect(SessionRules.isDocumentExpired(null, NOW)).toBe(false)
    expect(SessionRules.isDocumentExpired(undefined, NOW)).toBe(false)
  })

  it('does not re-expire terminal sessions', () => {
    expect(SessionRules.shouldExpire('processing', '2020-01-01T00:00:00.000Z', NOW)).toBe(true)
    expect(SessionRules.shouldExpire('approved', '2020-01-01T00:00:00.000Z', NOW)).toBe(false)
  })
})

describe('risk scoring', () => {
  it('clamps to [0, 1]', () => {
    expect(Risk.clamp01(-1)).toBe(0)
    expect(Risk.clamp01(2)).toBe(1)
    expect(Risk.clamp01(Number.NaN)).toBe(0)
    expect(Risk.clamp01(0.5)).toBe(0.5)
  })

  it('is low for strong signals and high for hard failures', () => {
    const strong = Risk.score({
      document: { qualityScore: 1, ocrConfidence: 1, expired: false },
      liveness: { passed: true, score: 1, multipleFaces: false },
      faceMatch: { passed: true, similarityScore: 1 },
    })
    expect(strong).toBeLessThan(0.1)

    const failed = Risk.score({
      document: { qualityScore: 0.9, ocrConfidence: 0.9, expired: false },
      liveness: { passed: false, score: 0.2, multipleFaces: false },
      faceMatch: { passed: true, similarityScore: 0.9 },
    })
    expect(failed).toBeGreaterThanOrEqual(0.9)
  })
})

describe('result normalization', () => {
  const ocr: OcrResultData = {
    fields: { fullName: 'Jane Doe', expiryDate: '2030-01-01' },
    confidence: 0.88,
  }
  const liveness: LivenessResultData = {
    passed: true,
    score: 0.93,
    spoofSignals: { multipleFaces: true },
  }
  const faceMatch: FaceMatchResultData = { passed: true, similarityScore: 0.82, confidence: 0.9 }
  const signals: SessionSignals = { documentQualityScore: 0.88, ocr, liveness, faceMatch }

  it('flattens provider results into decision input', () => {
    const input = Normalize.toDecisionInput(signals, NOW)
    expect(input.document).toEqual({ qualityScore: 0.88, ocrConfidence: 0.88, expired: false })
    expect(input.liveness).toEqual({ passed: true, score: 0.93, multipleFaces: true })
    expect(input.faceMatch).toEqual({ passed: true, similarityScore: 0.82 })
  })

  it('builds the webhook checks summary', () => {
    expect(Normalize.toWebhookChecks(signals, NOW)).toEqual({
      document: { quality_score: 0.88, ocr_confidence: 0.88, expired: false },
      liveness: { passed: true, score: 0.93 },
      face_match: { passed: true, similarity_score: 0.82 },
    })
  })
})

describe('tenant/project context', () => {
  const entity = { tenant_id: 'tenant_1' }

  it('checks tenant ownership', () => {
    expect(TenantContext.belongsTo(entity, 'tenant_1')).toBe(true)
    expect(TenantContext.belongsTo(entity, 'tenant_2')).toBe(false)
  })

  it('asserts scope or throws', () => {
    expect(TenantContext.assertScope(entity, 'tenant_1')).toBe(entity)
    expect(() => TenantContext.assertScope(entity, 'tenant_2')).toThrow(TenantScopeError)
  })

  it('builds canonical session storage paths', () => {
    const path = TenantContext.storagePath({ tenantId: 't1', projectId: 'p1' }, 's1', 'documents', 'front.jpg')
    expect(path).toBe('tenants/t1/projects/p1/sessions/s1/documents/front.jpg')
  })
})
