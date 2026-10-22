import { Storage } from '@arkstack/filesystem'
import { Organization } from '@app/models/Organization'
import { Project } from '@app/models/Project'

/**
 * Permanently deletes projects and organizations. Stored files go first, by key
 * prefix; deleting the row then cascades to every association (sessions, checks,
 * keys, webhooks, members, signals, audit logs).
 */
export class DeletionService {
  /**
   * Delete a project, its files and everything attached to it.
   *
   * @param projectId
   */
  async deleteProject(projectId: string): Promise<void> {
    const project = await Project.where({ id: projectId }).first()

    if (!project) return

    await Storage.disk().deleteAll(`organizations/${project.organizationId}/projects/${project.id}/`)

    await project.delete()
  }

  /**
   * Delete an organization, its files, every project in it and everything attached.
   *
   * @param organizationId
   */
  async deleteOrganization(organizationId: string): Promise<void> {
    const organization = await Organization.where({ id: organizationId }).first()

    if (!organization) return

    await Storage.disk().deleteAll(`organizations/${organization.id}/`)

    await organization.delete()
  }
}

/** Shared singleton. */
export const deletion = new DeletionService()
