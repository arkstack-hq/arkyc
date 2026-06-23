import type { ProjectContext } from '@arkyc/types'
import type { Organization } from '@app/models/Organization'
import type { OrganizationMember } from '@app/models/OrganizationMember'
import type { VerificationSession } from '@app/models/VerificationSession'

/**
 * Request augmentation for Arkyc-specific context attached by middleware.
 * Mirrors how @arkstack/auth augments `node:http` with `authUser`/`auth`.
 */
declare module 'node:http' {
  interface IncomingMessage {
    /** Active organization resolved from the route (dashboard surface). */
    organization?: Organization
    /** The acting user's membership in {@link organization}. */
    organizationMember?: OrganizationMember
    /** Organization + project resolved from a secret API key (public surface). */
    projectContext?: ProjectContext
    /** Session resolved from a short-lived client token (widget surface). */
    verificationSession?: VerificationSession
    /** Correlation id for the request. */
    requestId?: string
  }
}

export {}
