import { describe, expect, it } from 'vitest';
import { WebhookPayload, WebhookSigner } from '../src/index';

const SECRET = 'whsec_test_secret';

describe('webhooks — signing', () => {
  it('verifies a freshly signed payload', () => {
    const now = 1_700_000_000_000;
    const ts = Math.floor(now / 1000);
    const body = JSON.stringify({ event: 'verification.approved' });
    const signature = WebhookSigner.sign(body, SECRET, ts);

    expect(WebhookSigner.verify({ payload: body, secret: SECRET, signature, timestamp: ts, now })).toBe(true);
  });

  it('rejects a tampered body', () => {
    const now = 1_700_000_000_000;
    const ts = Math.floor(now / 1000);
    const signature = WebhookSigner.sign('{"a":1}', SECRET, ts);

    expect(WebhookSigner.verify({ payload: '{"a":2}', secret: SECRET, signature, timestamp: ts, now })).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const now = 1_700_000_000_000;
    const ts = Math.floor(now / 1000);
    const body = '{"a":1}';
    const signature = WebhookSigner.sign(body, SECRET, ts);

    expect(WebhookSigner.verify({ payload: body, secret: 'nope', signature, timestamp: ts, now })).toBe(false);
  });

  it('rejects a stale timestamp', () => {
    const now = 1_700_000_000_000;
    const ts = Math.floor(now / 1000) - 1_000; // well beyond tolerance
    const body = '{"a":1}';
    const signature = WebhookSigner.sign(body, SECRET, ts);

    expect(WebhookSigner.verify({ payload: body, secret: SECRET, signature, timestamp: ts, now })).toBe(false);
  });
});

describe('webhooks — payload', () => {
  it('builds the spec-shaped event body', () => {
    const payload = WebhookPayload.build({
      event: 'verification.approved',
      sessionId: 's1',
      tenantId: 't1',
      projectId: 'p1',
      userReference: 'user-9',
      status: 'approved',
      checks: { document: { quality_score: 0.9, ocr_confidence: 0.92, expired: false } },
      decisionReason: 'AUTO_APPROVED',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(payload.session_id).toBe('s1');
    expect(payload.event).toBe('verification.approved');
    expect(payload.checks.document?.quality_score).toBe(0.9);
  });
});
