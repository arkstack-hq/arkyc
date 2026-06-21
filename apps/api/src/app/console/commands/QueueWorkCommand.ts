import { QueueWorkCommand as BaseQueueWorkCommand } from '@arkstack/queue/commands/QueueWorkCommand'
import '@app/jobs'

/**
 * `ark queue:work [connection] [--queue=…] [--once] [--stop-when-empty]` — the
 * Arkstack queue worker. Importing `@app/jobs` registers the job classes so the
 * worker can reconstruct them from stored payloads on the `database`/`redis`
 * connections. (In dev/tests the default `sync` connection runs jobs inline, so
 * no worker is needed.)
 */
export class QueueWorkCommand extends BaseQueueWorkCommand {}
