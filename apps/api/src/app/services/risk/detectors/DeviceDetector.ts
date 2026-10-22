import { isPrivateAddress, toAlpha2, type NetworkInfo } from '@arkyc/network'
import { DEFAULT_VELOCITY_SETTINGS, type RiskSignal } from '@arkyc/types'
import { Project } from '@app/models/Project'
import { SessionClientToken } from '@app/models/SessionClientToken'
import { VerificationSession } from '@app/models/VerificationSession'
import { networkDriver } from '@app/services/providers'
import { reportError } from 'src/support/observability'
import type { RiskContext, RiskDetector } from '../types'

const MINUTE_MS = 60_000

/**
 * Repeat sessions from one address, and risky or mismatched networks. Private
 * and loopback addresses are skipped: they mean a proxy whose `TRUST_PROXY` is unset.
 */
export class DeviceDetector implements RiskDetector {
  readonly source = 'device'

  async detect({ session, ocr }: RiskContext): Promise<RiskSignal[]> {
    const device = await SessionClientToken.query()
      .where({ sessionId: session.id, kind: 'device' })
      .whereNotNull('ipAddress')
      .latest('createdAt')
      .first()

    if (!device?.ipAddress || isPrivateAddress(device.ipAddress)) return []

    const ip = device.ipAddress
    const signals: RiskSignal[] = []

    const velocity = await this.velocity(session, ip)

    if (velocity) signals.push(velocity)

    const network = await this.lookup(ip, session.id)

    if (network && (network.vpn || network.tor || network.proxy || network.hosting)) {
      signals.push({
        key: 'high_risk_network',
        severity: 'review',
        score: 0.5,
        evidence: {
          ip,
          vpn: network.vpn,
          tor: network.tor,
          proxy: network.proxy,
          hosting: network.hosting,
          asn: network.asn,
          organization: network.organization,
        },
      })
    }

    const nationality = toAlpha2(ocr?.fields.nationality)

    if (network?.country && nationality && network.country !== nationality) {
      signals.push({
        key: 'ip_country_mismatch',
        severity: 'review',
        score: 0.2,
        evidence: { ip, ip_country: network.country, nationality },
      })
    }

    return signals
  }

  /** More sessions from this address, under other user references, than the project allows. */
  private async velocity(session: VerificationSession, ip: string): Promise<RiskSignal | null> {
    const project = await Project.where({ id: session.projectId }).first()
    const limits = { ...DEFAULT_VELOCITY_SETTINGS, ...(project?.settings?.velocity ?? {}) }
    const since = new Date(Date.now() - limits.window_minutes * MINUTE_MS)

    const others = await VerificationSession.query()
      .where({ projectId: session.projectId })
      .where('id', '!=', session.id)
      .where('createdAt', '>=', since)
      .whereHas('clientTokens', (tokens) => tokens.where({ kind: 'device', ipAddress: ip }))
      .when(!!session.userReference, (query) =>
        query.where((group: typeof query) =>
          group.whereNull('userReference').orWhere('userReference', '!=', session.userReference!),
        ),
      )
      .count()

    const sessions = others + 1

    if (sessions <= limits.max_sessions) return null

    return {
      key: 'velocity_exceeded',
      severity: 'review',
      score: 0.4,
      evidence: { ip, sessions, max_sessions: limits.max_sessions, window_minutes: limits.window_minutes },
    }
  }

  private async lookup(ip: string, sessionId: string): Promise<NetworkInfo | null> {
    try {
      return await networkDriver.lookup(ip)
    } catch (error) {
      reportError(error, { scope: 'network', sessionId })

      return null
    }
  }
}
