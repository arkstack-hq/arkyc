import { Job } from '@arkstack/jobs'
import { deletion } from '@app/services/DeletionService'

/** Deletes a project or organization in the background (queue `queue.queues.maintenance`). */
export class DeletionJob extends Job {
  override queue = config('queue.queues.maintenance', 'maintenance')
  override tries = 3
  override backoff = 30

  constructor(
    public kind: 'project' | 'organization',
    public id: string,
  ) {
    super()
  }

  async handle(): Promise<void> {
    if (this.kind === 'project') await deletion.deleteProject(this.id)
    else await deletion.deleteOrganization(this.id)
  }
}
