import { describe, expect, it } from 'vitest';
import type {
  DecisionReason,
  PermissionKey,
  VerificationSession,
  VerificationStatus,
} from '../src/index';

/**
 * `@arkyc/types` is type-only, so these tests double as compile-time shape
 * checks: each constructed value must satisfy its annotated type for the suite
 * to typecheck, while the runtime assertions keep the suite non-empty.
 */
describe('types', () => {
  it('models verification status and decision reasons', () => {
    const status: VerificationStatus = 'requires_review';
    const reason: DecisionReason = 'FACE_MATCH_LOW_CONFIDENCE';
    expect(status).toBe('requires_review');
    expect(reason).toBe('FACE_MATCH_LOW_CONFIDENCE');
  });

  it('models a permission key', () => {
    const perm: PermissionKey = 'sessions.view';
    expect(perm).toBe('sessions.view');
  });

  it('models a tenant/project-scoped session', () => {
    const session: Pick<VerificationSession, 'tenant_id' | 'project_id' | 'status'> = {
      tenant_id: 'tenant_123',
      project_id: 'project_123',
      status: 'pending',
    };
    expect(session.tenant_id).toBe('tenant_123');
    expect(session.project_id).toBe('project_123');
  });
});
