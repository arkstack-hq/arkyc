import type { DecisionReason, VerificationStatus, WebhookChecks, WebhookEvent, WebhookEventName } from '@arkyc/types'

/** The data needed to assemble a {@link WebhookEvent} body. */
export interface BuildWebhookPayloadInput {
  event: WebhookEventName
  sessionId: string
  organizationId: string
  projectId: string
  userReference: string | null
  status: VerificationStatus
  checks: WebhookChecks
  decisionReason: DecisionReason | null
  /** ISO-8601 timestamp the event occurred. */
  createdAt: string
}

/**
 * Assemble the JSON body delivered to a webhook endpoint.
 */
export class WebhookPayload {
  /**
   * Build the JSON body delivered to a webhook endpoint (matches the spec shape).
   *
   * @param input
   * @returns
   */
  static build(input: BuildWebhookPayloadInput): WebhookEvent {
    return {
      event: input.event,
      session_id: input.sessionId,
      organization_id: input.organizationId,
      project_id: input.projectId,
      user_reference: input.userReference,
      status: input.status,
      checks: input.checks,
      decision_reason: input.decisionReason,
      created_at: input.createdAt,
    }
  }
}
