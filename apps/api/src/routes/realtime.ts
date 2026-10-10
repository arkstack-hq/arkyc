import { auth } from '@arkstack/driver-express/middlewares'
import { Broadcast } from '@arkstack/notifications'
import { Router } from '@arkstack/driver-express'
import RealtimeController from '@controllers/realtime/RealtimeController'
import { OrganizationMember } from '@app/models/OrganizationMember'
import { Project } from '@app/models/Project'
import { VerificationSession } from '@app/models/VerificationSession'

/**
 * Whether `subject` is a dashboard user belonging to the organization.
 *
 * @param subject
 * @param organizationId
 * @returns
 */
const isMember = async (subject: unknown, organizationId: string): Promise<boolean> => {
  const userId = (subject as { id?: string } | null)?.id
  if (!userId || subject instanceof VerificationSession) return false

  return !!(await OrganizationMember.where({ userId, organizationId }).first())
}

Broadcast.channel('private-organization.{organizationId}', (subject, { organizationId }) =>
  isMember(subject, organizationId),
)

Broadcast.channel(
  'private-organization.{organizationId}.project.{projectId}',
  async (subject, { organizationId, projectId }) =>
    !!(await Project.where({ id: projectId, organizationId }).first()) && (await isMember(subject, organizationId)),
)

// The widget joins with its session (client token); dashboard users join via the session's organization.
Broadcast.channel('private-session.{sessionId}', async (subject, { sessionId }) => {
  if (subject instanceof VerificationSession) return subject.id === sessionId

  const session = await VerificationSession.where({ id: sessionId }).first()

  return !!session && (await isMember(subject, session.organizationId))
})

Router.group('/v1/realtime', () => {
  Router.post('/auth', [RealtimeController, 'auth'], [auth])
  Router.get('/config', [RealtimeController, 'config'], [auth])
})

export default () => {}
