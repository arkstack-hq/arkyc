/**
 * @arkyc/sdk
 *
 * Arkyc server SDK: a typed client for the Public Project API plus webhook
 * verification. The browser widget launcher lives at `@arkyc/sdk/browser`.
 */
export { Arkyc } from './client'
export { ArkycApiError } from './errors'
export type { ApiErrorKey } from '@arkyc/types'
export type { ArkycOptions, CreateSessionParams, CreatedSession, VerificationSession } from './types'

// Re-export the webhook signer (sign/verify + signature headers) so integrators
// don't need a separate dependency.
export { type VerifyWebhookInput, WebhookSigner } from '@arkyc/webhooks'

export { Webhooks } from './Webhooks'
export { Sessions } from './Sessions'
