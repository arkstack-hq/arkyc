import '@app/jobs'

import { Command } from '@h3ravel/musket'
import { Logger } from '@arkstack/common'
import { SessionSweepJob } from '@app/jobs'
import { queueRunsInline } from 'src/support/session-sweep'
import { sessionService } from '@app/services/VerificationSessionService'

/**
 * `ark session:sweep [--loop]` — expire timed-out verification sessions.
 *
 * Without `--loop` it runs a single sweep synchronously and exits (portable: run
 * it on whatever external cadence you have). With `--loop` it dispatches the
 * self-perpetuating `SessionSweepJob` onto the queue to start the recurring chain
 * — the no-cron option for hosts like Railway (requires `SESSION_SWEEP_DRIVER=queue`
 * and an async queue connection + a running `ark queue:work`).
 */
export class SessionSweepCommand extends Command {
  signature = `session:sweep
        {--loop : Start the self-perpetuating queue chain instead of a single run}
    `

  description = 'Expire timed-out verification sessions'

  async handle() {
    if (this.option('loop')) {
      if (queueRunsInline()) {
        Logger.error('--loop needs an async queue connection (QUEUE_CONNECTION=database|redis); sync would recurse.')

        return
      }
      await SessionSweepJob.dispatch()
      Logger.success('Session-sweep chain started (SessionSweepJob queued).', true)

      return
    }

    const expired = await sessionService.sweepExpired()
    Logger.success(`Session sweep complete — expired ${expired} session(s).`, true)
  }
}
