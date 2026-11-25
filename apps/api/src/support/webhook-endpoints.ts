import type { WebhookDeliveryStatus, WebhookEventName } from '@arkyc/types'

/** The webhook event names an endpoint subscription may include. */
export const WEBHOOK_EVENT_NAMES: WebhookEventName[] = [
  'verification.started',
  'verification.document_submitted',
  'verification.address_submitted',
  'verification.processing',
  'verification.requires_review',
  'verification.approved',
  'verification.rejected',
  'verification.completed',
  'verification.expired',
  'verification.cancelled',
  'verification.screening_alert',
]

const EVENTS_RULE = `in:${WEBHOOK_EVENT_NAMES.join(',')}`

/**
 * Validation for registering an endpoint. Shared by the dashboard and the Public
 * Project API so both accept exactly the same input.
 */
export const createEndpointRules = {
  url: ['required', 'string', 'url', 'max:2048'],
  events: ['required', 'array'],
  'events.*': ['string', EVENTS_RULE],
}

/** Validation for updating an endpoint: every field optional. */
export const updateEndpointRules = {
  url: ['nullable', 'string', 'url', 'max:2048'],
  events: ['nullable', 'array'],
  'events.*': ['string', EVENTS_RULE],
  status: ['nullable', 'in:active,disabled'],
}

/**
 * Validation for updating the endpoint identified by its signing secret (Public
 * Project API), so an integrator that already stores the secret to verify
 * deliveries needn't also store the endpoint's id.
 */
export const updateEndpointBySecretRules = {
  secret: ['required', 'string', 'max:255'],
  ...updateEndpointRules,
}

const DELIVERY_STATUSES: WebhookDeliveryStatus[] = ['pending', 'delivered', 'failed']

/** The delivery status a list request filters by, or `null` for every status. */
export function deliveryStatusFilter(value: unknown): WebhookDeliveryStatus | null {
  const status = Array.isArray(value) ? value[0] : value

  return DELIVERY_STATUSES.includes(status as WebhookDeliveryStatus) ? (status as WebhookDeliveryStatus) : null
}
