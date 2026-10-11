import { Command } from '@h3ravel/musket'
import { Logger } from '@arkstack/common'
import { screeningMonitors } from '@app/services/risk/ScreeningMonitorService'

/**
 * `ark screening:monitor`: re-screen one batch of monitored identities that are
 * due. The scheduler and the queue sweep also run it under their drivers.
 */
export class ScreeningMonitorCommand extends Command {
  signature = 'screening:monitor'

  description = 'Re-screen monitored identities against watchlists'

  async handle() {
    const screened = await screeningMonitors.runDue()
    Logger.success(`Screening monitor complete: re-screened ${screened} identity(ies).`, true)
  }
}
