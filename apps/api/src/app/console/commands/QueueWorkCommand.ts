import { drain, processNext } from '@app/jobs'

import { Command } from '@h3ravel/musket'

/**
 * `ark queue:work [queue] [--once]` — runs the verification job worker.
 *
 * Without a queue argument it processes every queue (`ocr`, `biometric`); pass
 * one (e.g. `ark queue:work ocr`) to run a dedicated worker. `--once` drains all
 * currently-runnable jobs and exits (handy for cron / CI).
 */
export class QueueWorkCommand extends Command {
  /** How long to wait before polling again when the queue is idle. */
  private static IDLE_POLL_MS = 1000

  protected signature = `queue:work
    {queue? : Only process this queue (default: all)}
    {--once : Drain runnable jobs then exit}
  `

  protected description = 'Run the verification job worker (ocr, biometric)'

  sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

  async handle (): Promise<void> {
    const queueName = (this.argument('queue') as string | undefined) || undefined
    const once = Boolean(this.option('once'))

    this.info(
      `Queue worker started${queueName ? ` for "${queueName}"` : ''}${once ? ' (once)' : ''}`
    )

    if (once) {
      await drain(queueName)
      this.success('Drained all runnable jobs.')

      return
    }

    for (; ;) {
      const processed = await processNext(queueName)
      if (!processed) await this.sleep(QueueWorkCommand.IDLE_POLL_MS)
    }
  }
}
