import type { ProjectContext } from '@arkyc/types'
import type { Tenant } from '@app/models/Tenant'
import type { TenantMember } from '@app/models/TenantMember'
import type { VerificationSession } from '@app/models/VerificationSession'

/**
 * Request augmentation for Arkyc-specific context attached by middleware.
 * Mirrors how @arkstack/auth augments `node:http` with `authUser`/`auth`.
 */
declare module 'node:http' {
  interface IncomingMessage {
    /** Active tenant resolved from the route (dashboard surface). */
    tenant?: Tenant
    /** The acting user's membership in {@link tenant}. */
    tenantMember?: TenantMember
    /** Tenant + project resolved from a secret API key (public surface). */
    projectContext?: ProjectContext
    /** Session resolved from a short-lived client token (widget surface). */
    verificationSession?: VerificationSession
    /** Correlation id for the request. */
    requestId?: string
  }
}

export {}
