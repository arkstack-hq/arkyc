import type { HttpContext } from 'clear-router/types/express'
import type { Metadata } from '@arkyc/types'
import { PlatformAuditLog } from '@app/models/PlatformAuditLog'

/** A single platform-admin audit entry to persist. */
export interface PlatformAuditEntry {
  actorId?: string | null
  /** Dot-namespaced event, e.g. `platform.settings_updated`, `platform.admin_granted`. */
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Metadata | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Writes the append-only platform-admin audit trail (Phase 15). Records every
 * state-changing action on the `/admin` surface — who did it, from where, and
 * against which entity. Separate from the organization {@link AuditLogger}.
 */
export class PlatformAuditLogger {
  /** Persist a platform audit entry. */
  async record(entry: PlatformAuditEntry): Promise<void> {
    await PlatformAuditLog.create({
      actorId: entry.actorId ?? null,
      actorType: 'user',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    })
  }

  /** Record an entry for an admin request — actor/IP/UA come from `req.user`. */
  async recordForRequest(
    req: HttpContext['req'],
    entry: {
      action: string
      entityType: string
      entityId?: string | null
      metadata?: Metadata | null
    },
  ): Promise<void> {
    await this.record({
      actorId: req.user?.id ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    })
  }
}

/** Shared singleton platform audit logger. */
export const platformAudit = new PlatformAuditLogger()
