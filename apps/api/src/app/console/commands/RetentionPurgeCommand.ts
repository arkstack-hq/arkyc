import { Command } from '@h3ravel/musket'
import { Logger } from '@arkstack/common'
import { retentionService } from '@app/services/RetentionService'

/**
 * `ark retention:purge` — delete captured media for sessions past their
 * organization's `retention_days`. A single synchronous run (portable: schedule
 * it however you like on hosts without cron); the scheduler and the queue sweep
 * also drive it automatically under their respective drivers.
 */
export class RetentionPurgeCommand extends Command {
  signature = 'retention:purge'

  description = 'Purge verification media past its retention window'

  async handle() {
    const purged = await retentionService.purgeExpiredMedia()
    Logger.success(`Retention purge complete — cleared media for ${purged} session(s).`, true)
  }
}
