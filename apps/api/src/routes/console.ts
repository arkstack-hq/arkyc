import { Schedule } from '@arkstack/scheduler'
import { sessionService } from '@app/services/VerificationSessionService'
import { sessionSweepDriver } from 'src/support/session-sweep'

/*
 * Console schedule
 *
 * Define your scheduled tasks here. In production, run them with a single system
 * cron entry:
 *
 *   * * * * * cd /path/to/app && npx ark schedule:run >> /dev/null 2>&1
 *
 * During development, run `ark schedule:work` to evaluate tasks every minute.
 */

// Expire sessions whose TTL has passed but that no reader touched (the lazy
// per-request refresh only fires on access). Fires `verification.expired`
// webhooks + realtime for each. `withoutOverlapping` guards a slow run from
// piling onto the next tick. Skipped under the `queue`/`off` drivers, where the
// self-perpetuating `SessionSweepJob` (or nothing) drives the sweep instead — so
// the two mechanisms never double-run.
if (sessionSweepDriver() === 'schedule') {
  Schedule.call(async () => {
    await sessionService.sweepExpired()
  })
    .everyFiveMinutes()
    .withoutOverlapping()
    .description('Expire timed-out verification sessions')
}
