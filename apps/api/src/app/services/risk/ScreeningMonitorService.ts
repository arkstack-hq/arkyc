import { env } from '@arkstack/common'
import { RiskSignals } from '@arkyc/core'
import type { ScreeningHit } from '@arkyc/types'
import { OcrResult } from '@app/models/OcrResult'
import { ScreeningMonitor } from '@app/models/ScreeningMonitor'
import { SessionRiskSignal } from '@app/models/SessionRiskSignal'
import { VerificationSession } from '@app/models/VerificationSession'
import { sessionNotifications } from '@app/notifications/SessionNotifications'
import { screeningDriver } from '@app/services/providers'
import { webhookService } from '@app/services/WebhookService'
import { toArray } from 'src/support/collection'
import { reportError } from 'src/support/observability'
import { ScreeningDetector } from './detectors/ScreeningDetector'

const HOUR_MS = 3_600_000

/** Statuses whose identity stays monitored. */
const MONITORED_STATUSES = ['approved', 'requires_review']

/**
 * Ongoing screening: re-screens monitored sessions on a schedule and raises a
 * signal, a reviewer notification and a `verification.screening_alert` webhook
 * for entities that weren't on the lists before.
 */
export class ScreeningMonitorService {
  /**
   * Start (or refresh) monitoring for a decided session.
   *
   * @param session
   * @param threshold
   * @param hits Hits already raised, which re-screens won't report again.
   */
  async enroll(session: VerificationSession, threshold: number, hits: ScreeningHit[]): Promise<void> {
    await ScreeningMonitor.query().updateOrCreate(
      { sessionId: session.id },
      {
        organizationId: session.organizationId,
        projectId: session.projectId,
        threshold,
        knownEntityIds: hits.map((hit) => hit.entity_id),
        active: true,
        nextScreenAt: this.nextRun(),
      },
    )
  }

  /**
   * Re-screen one bounded batch of due monitors.
   *
   * @param limit
   * @returns The number of monitors screened.
   */
  async runDue(limit = 200): Promise<number> {
    const due = toArray(
      await ScreeningMonitor.query()
        .where({ active: true })
        .where('nextScreenAt', '<=', new Date())
        .orderBy({ nextScreenAt: 'asc' })
        .limit(limit)
        .get(),
    )

    for (const monitor of due) {
      try {
        await this.rescreen(monitor)
      } catch (error) {
        reportError(error, { scope: 'screening-monitor', monitorId: monitor.id })
        monitor.nextScreenAt = this.nextRun()
        await monitor.save()
      }
    }

    return due.length
  }

  /**
   * Stop monitoring a session.
   *
   * @param sessionId
   */
  async stop(sessionId: string): Promise<void> {
    await ScreeningMonitor.query().where({ sessionId }).updateFrom({ active: false })
  }

  private async rescreen(monitor: ScreeningMonitor): Promise<void> {
    const session = await VerificationSession.where({ id: monitor.sessionId }).first()
    const ocr = session ? await OcrResult.where({ sessionId: session.id }).first() : null
    const subject = ScreeningDetector.subject(ocr?.fields)

    if (!session || !subject || !MONITORED_STATUSES.includes(session.status)) {
      monitor.active = false
      await monitor.save()

      return
    }

    const known = new Set(monitor.knownEntityIds ?? [])
    const { hits } = await screeningDriver.screen(subject, { threshold: monitor.threshold })
    const fresh = hits.filter((hit) => !known.has(hit.entity_id))

    if (fresh.length) {
      const signals = RiskSignals.applyPolicy(ScreeningDetector.signals(fresh), session.workflow?.options.risk_policy)

      for (const signal of signals) {
        await SessionRiskSignal.create({
          organizationId: session.organizationId,
          projectId: session.projectId,
          sessionId: session.id,
          key: signal.key,
          severity: signal.severity === 'reject' ? 'review' : signal.severity,
          score: signal.score,
          advisory: false,
          source: 'monitoring',
          evidence: signal.evidence,
        })
      }

      await sessionNotifications.screeningHit(session, fresh, true)
      await webhookService.dispatch(session, 'verification.screening_alert')
    }

    monitor.knownEntityIds = [...known, ...fresh.map((hit) => hit.entity_id)]
    monitor.lastScreenedAt = new Date()
    monitor.nextScreenAt = this.nextRun()
    await monitor.save()
  }

  private nextRun(): Date {
    return new Date(Date.now() + Number(env('SCREENING_MONITOR_INTERVAL_HOURS', '24')) * HOUR_MS)
  }
}

/** Shared singleton. */
export const screeningMonitors = new ScreeningMonitorService()
