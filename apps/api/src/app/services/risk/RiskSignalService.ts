import { RiskSignals } from '@arkyc/core'
import { workflowScreeningConfig, type RiskPolicyConfig, type WorkflowConfig } from '@arkyc/types'
import { SessionRiskSignal } from '@app/models/SessionRiskSignal'
import type { VerificationSession } from '@app/models/VerificationSession'
import { sessionNotifications } from '@app/notifications/SessionNotifications'
import { DeviceDetector } from './detectors/DeviceDetector'
import { DocumentDetector } from './detectors/DocumentDetector'
import { DuplicateDetector } from './detectors/DuplicateDetector'
import { FaceDuplicateDetector } from './detectors/FaceDuplicateDetector'
import { ScreeningDetector } from './detectors/ScreeningDetector'
import { screeningMonitors } from './ScreeningMonitorService'
import { screeningHits, type DetectedSignal, type RiskContext, type RiskDetector } from './types'

/**
 * Runs every risk detector for a session being decided, resolves each signal's
 * severity from the workflow policy, and stores the result.
 */
export class RiskSignalService {
  private readonly detectors: RiskDetector[] = [
    new DocumentDetector(),
    new ScreeningDetector(),
    new DuplicateDetector(),
    new FaceDuplicateDetector(),
    new DeviceDetector(),
  ]

  /**
   * Detect, resolve and store the session's signals, replacing any uncleared
   * ones from an earlier run.
   *
   * @param context
   * @returns The resolved signals, for the decision engine.
   */
  async evaluate(context: RiskContext): Promise<DetectedSignal[]> {
    const detected: DetectedSignal[] = []
    for (const detector of this.detectors) {
      for (const signal of await detector.detect(context)) detected.push({ ...signal, source: detector.source })
    }

    const signals = RiskSignals.applyPolicy(detected, this.policy(context.workflow))
    const { session } = context

    await SessionRiskSignal.query().where({ sessionId: session.id }).whereNull('clearedAt').delete()
    for (const signal of signals) await this.store(session, signal)

    return signals
  }

  /**
   * Follow-up once the session is decided: enrol it in screening monitoring and
   * tell reviewers about watchlist hits.
   *
   * @param session
   * @param signals
   */
  async afterDecision(session: VerificationSession, signals: DetectedSignal[]): Promise<void> {
    const config = workflowScreeningConfig(session.workflow)
    const hits = screeningHits(signals)

    if (config?.monitor && session.status !== 'rejected') {
      await screeningMonitors.enroll(session, config.threshold, hits)
    }

    await sessionNotifications.screeningHit(session, hits)
  }

  /**
   * Store one signal against the session.
   *
   * @param session
   * @param signal
   * @returns
   */
  async store(session: VerificationSession, signal: DetectedSignal): Promise<SessionRiskSignal> {
    return await SessionRiskSignal.create({
      organizationId: session.organizationId,
      projectId: session.projectId,
      sessionId: session.id,
      key: signal.key,
      severity: signal.severity,
      score: signal.score,
      advisory: signal.advisory === true,
      source: signal.source,
      evidence: signal.evidence,
    })
  }

  /**
   * The workflow's policy, with the screening stage's `on_hit` deciding sanctions hits.
   *
   * @param workflow
   * @returns
   */
  policy(workflow: WorkflowConfig | null): RiskPolicyConfig {
    const screening = workflowScreeningConfig(workflow)

    return { ...(workflow?.options.risk_policy ?? {}), ...(screening ? { sanctions_match: screening.on_hit } : {}) }
  }
}

/** Shared singleton. */
export const riskSignals = new RiskSignalService()
