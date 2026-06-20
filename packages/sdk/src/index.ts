/**
 * @arkyc/sdk
 *
 * Arkyc server SDK: a typed client for the Public Project API plus webhook
 * verification. The browser widget launcher lives at `@arkyc/sdk/browser`.
 */
export { Arkyc } from './client'
export { ArkycApiError } from './errors'
export type {
  ArkycOptions,
  CreateSessionParams,
  CreatedSession,
  VerificationSession,
} from './types'

// Re-export the webhook verification helpers so integrators don't need a
// separate dependency.
export {
  type VerifyWebhookInput,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signWebhook,
  verifyWebhookSignature,
} from '@arkyc/webhooks'
