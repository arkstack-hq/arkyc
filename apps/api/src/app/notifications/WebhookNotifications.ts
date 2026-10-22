import { Cache } from '@arkstack/cache'
import { NOTIFICATION_TYPE } from '@arkyc/types'
import { Organization } from '@app/models/Organization'
import { Project } from '@app/models/Project'
import type { WebhookDelivery } from '@app/models/WebhookDelivery'
import type { WebhookEndpoint } from '@app/models/WebhookEndpoint'
import { NotificationAudience } from './NotificationAudience'
import { NotificationEvent } from './NotificationEvent'

/** At most one failing-endpoint notification per endpoint in this window. */
const THROTTLE_SECONDS = 60 * 60

/** Notifications about webhook endpoints. */
export class WebhookNotifications {
  /**
   * Tell the project's webhook maintainers that a delivery exhausted its retries.
   *
   * @param endpoint
   * @param delivery
   */
  async failing(endpoint: WebhookEndpoint, delivery: WebhookDelivery): Promise<void> {
    const fresh = await Cache.add(`notifications:webhook-failing:${endpoint.id}`, '1', THROTTLE_SECONDS).catch(
      () => true,
    )

    if (!fresh) return

    const [organization, project] = await Promise.all([
      Organization.where({ id: endpoint.organizationId })
        .first()
        .catch(() => null),
      Project.where({ id: endpoint.projectId })
        .first()
        .catch(() => null),
    ])
    const status = delivery.responseStatus ? `HTTP ${delivery.responseStatus}` : 'no response'

    await NotificationEvent.make(NOTIFICATION_TYPE.webhookFailing)
      .toAudience(async () =>
        NotificationAudience.withPermission('webhooks.update', endpoint.organizationId, endpoint.projectId),
      )
      .about({
        title: 'Webhook deliveries failing',
        description: `${endpoint.url} in ${project?.name ?? 'your project'} failed a ${delivery.event} delivery after ${delivery.attempts} attempts (${status}).`,
        actionText: 'Review webhooks',
        actionLink: organization && project ? `/o/${organization.slug}/projects/${project.id}/webhooks` : null,
        meta: {
          endpoint_id: endpoint.id,
          delivery_id: delivery.id,
          organization_id: endpoint.organizationId,
          project_id: endpoint.projectId,
        },
        tag: `webhook:${endpoint.id}`,
      })
      .dispatchSafely()
  }
}

/** Shared singleton. */
export const webhookNotifications = new WebhookNotifications()
