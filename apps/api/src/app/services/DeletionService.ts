import { Storage } from '@arkstack/filesystem'
import { Organization } from '@app/models/Organization'
import { Project } from '@app/models/Project'
import { VerificationSession } from '@app/models/VerificationSession'
import { retentionService } from '@app/services/RetentionService'

const BATCH_SIZE = 200

/**
 * Permanently deletes projects and organizations. Stored media is removed first,
 * in bounded batches; deleting the row then cascades to every association
 * (sessions, checks, keys, webhooks, members, signals, audit logs).
 */
export class DeletionService {
  /**
   * Delete a project, its media and everything attached to it.
   *
   * @param projectId
   */
  async deleteProject(projectId: string): Promise<void> {
    const project = await Project.where({ id: projectId }).first()

    if (!project) return

    await VerificationSession.query()
      .where({ projectId })
      .whereNull('mediaPurgedAt')
      .chunkById(BATCH_SIZE, async (sessions) => {
        for (const session of sessions) await retentionService.purgeSessionMedia(session)
      })

    const logoKey = project.branding?.logo_key

    if (logoKey)
      await Storage.disk()
        .delete(logoKey)
        .catch(() => {})

    await project.delete()
  }

  /**
   * Delete an organization, every project in it and everything attached.
   *
   * @param organizationId
   */
  async deleteOrganization(organizationId: string): Promise<void> {
    const organization = await Organization.where({ id: organizationId }).first()

    if (!organization) return

    await Project.query()
      .where({ organizationId })
      .chunkById(BATCH_SIZE, async (projects) => {
        for (const project of projects) await this.deleteProject(project.id)
      })

    await organization.delete()
  }
}

/** Shared singleton. */
export const deletion = new DeletionService()
