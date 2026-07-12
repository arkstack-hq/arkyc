import { Storage } from '@arkstack/filesystem'
import { AddressVerification } from '@app/models/AddressVerification'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { LivenessCheck } from '@app/models/LivenessCheck'
import { Organization } from '@app/models/Organization'
import { VerificationSession } from '@app/models/VerificationSession'
import { toArray } from 'src/support/collection'
import { reportError } from 'src/support/observability'

const DAY_MS = 86_400_000

/**
 * Per-tenant data retention (Phase 20). Deletes captured media (document images,
 * selfie, liveness video, proof-of-address image) once a session is older than
 * the organization's `retention_days`, keeping the session row, checks, and
 * decision for audit + stats. Media-only by design; PII redaction / full deletion
 * are deliberately out of scope.
 *
 * Idempotent + resumable: purged sessions are stamped with `mediaPurgedAt` and
 * skipped thereafter; storage deletes are best-effort (a missing object never
 * aborts the batch). Driven by the scheduler or the queue sweep (see
 * `routes/console.ts` / `SessionSweepJob`).
 */
export class RetentionService {
  /**
   * Purge media for sessions past their org's retention window.
   *
   * @param limit  Max sessions to purge per organization per run.
   * @returns The number of sessions purged.
   */
  async purgeExpiredMedia(limit = 500): Promise<number> {
    const orgs = toArray(await Organization.all())
    let purged = 0

    for (const org of orgs) {
      const days = org.settings?.retention_days
      if (!days || days <= 0) continue

      const cutoff = new Date(Date.now() - days * DAY_MS)
      const sessions = toArray(
        await VerificationSession.query()
          .where({ organizationId: org.id })
          .whereNull('mediaPurgedAt')
          .where('createdAt', '<', cutoff)
          .limit(limit)
          .get(),
      )

      for (const session of sessions) {
        try {
          await this.purgeSessionMedia(session)
          purged += 1
        } catch (error) {
          // One session failing shouldn't abort the tenant's batch.
          reportError(error, { scope: 'retention', sessionId: session.id })
        }
      }
    }

    return purged
  }

  /** Delete a single session's stored media, null the paths, and stamp the marker. */
  private async purgeSessionMedia(session: VerificationSession): Promise<void> {
    const disk = Storage.disk()

    for (const capture of toArray(await DocumentCapture.where({ sessionId: session.id }).get())) {
      await this.remove(disk, capture.frontImagePath)
      await this.remove(disk, capture.backImagePath)
      capture.frontImagePath = null
      capture.backImagePath = null
      await capture.save()
    }

    for (const liveness of toArray(await LivenessCheck.where({ sessionId: session.id }).get())) {
      await this.remove(disk, liveness.selfieImagePath)
      await this.remove(disk, liveness.videoPath)
      liveness.selfieImagePath = null
      liveness.videoPath = null
      await liveness.save()
    }

    for (const address of toArray(await AddressVerification.where({ sessionId: session.id }).get())) {
      await this.remove(disk, address.documentImagePath)
      address.documentImagePath = null
      await address.save()
    }

    session.mediaPurgedAt = new Date()
    await session.save()
  }

  /** Best-effort object delete: a missing key or storage hiccup never throws. */
  private async remove(disk: ReturnType<typeof Storage.disk>, key: string | null | undefined): Promise<void> {
    if (!key) return
    try {
      if (await disk.exists(key)) await disk.delete(key)
    } catch {
      // Best-effort — the DB path is nulled regardless, so the link won't resurface.
    }
  }
}

/** Shared singleton — holds no per-request state. */
export const retentionService = new RetentionService()
