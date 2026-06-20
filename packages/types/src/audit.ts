import type { Id, IsoDateTime, Metadata } from './common';

/** Who performed an audited action. */
export type ActorType = 'user' | 'api_key' | 'system';

/**
 * An immutable audit log entry. Project scope is optional (some actions are
 * tenant-level only). Audit rows are append-only and carry no `updated_at`.
 */
export interface AuditLog {
  id: Id;
  tenant_id: Id;
  project_id: Id | null;
  actor_id: Id | null;
  actor_type: ActorType;
  /** Action key, e.g. `session.approved`, `api_key.created`. */
  action: string;
  entity_type: string;
  entity_id: Id | null;
  metadata: Metadata;
  ip_address: string | null;
  user_agent: string | null;
  created_at: IsoDateTime;
}
