import type { HttpContext } from 'clear-router/types/express'
import type { ActorType, Metadata } from '@arkyc/types'
import { AuditLog } from '@app/models/AuditLog'

/** A single audit-trail entry to persist. */
export interface AuditEntry {
  tenantId: string
  projectId?: string | null
  actorId?: string | null
  actorType: ActorType
  /** Dot-namespaced event, e.g. `review.approved`, `session.created`. */
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Metadata | null
  ipAddress?: string | null
  userAgent?: string | null
}

/** The actor + request context for an audited action. */
export interface AuditActor {
  actorId: string | null
  actorType: ActorType
  ipAddress: string | null
  userAgent: string | null
}

/**
 * Writes the append-only audit trail (Phase 9). Records every state-changing
 * action with who did it, from where, and against which entity.
 */
export class AuditLogger {
  /** Persist an audit entry. */
  async record (entry: AuditEntry): Promise<void> {
    await AuditLog.create({
      tenantId: entry.tenantId,
      projectId: entry.projectId ?? null,
      actorId: entry.actorId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    })
  }

  /**
   * Record an entry for a tenant-scoped dashboard request — pulls `tenantId`
   * from `req.tenant` and the actor/IP/UA from the request.
   */
  async recordForRequest (
    req: HttpContext['req'],
    entry: {
      projectId?: string | null
      action: string
      entityType: string
      entityId?: string | null
      metadata?: Metadata | null
    },
  ): Promise<void> {
    const actor = this.actorFromRequest(req)
    await this.record({
      tenantId: req.tenant!.id,
      projectId: entry.projectId ?? null,
      actorId: actor.actorId,
      actorType: actor.actorType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    })
  }

  /** Derive the dashboard-user actor + request context from an HTTP request. */
  actorFromRequest (req: HttpContext['req']): AuditActor {
    return {
      actorId: req.user?.id ?? null,
      actorType: 'user',
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    }
  }
}

/** Shared singleton audit logger. */
export const audit = new AuditLogger()
