import { QueueClearCommand as BaseQueueClearCommand } from '@arkstack/queue/commands/QueueClearCommand'

/** `ark queue:clear [connection] [--queue=…]` — delete pending jobs on a queue. */
export class QueueClearCommand extends BaseQueueClearCommand {}
