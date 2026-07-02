import type { AccessCapability, AccessGrantDetails } from '@arkyc/types'

import { AccessGrant } from '@app/models/AccessGrant'

/** The organization + project a runtime check is scoped to. */
export interface AccessScope {
  organizationId: string
  projectId: string
}

/**
 * Whether a project has been granted a gated capability.
 *
 * Extended access is opt-in per capability: project owners request it and
 * platform admins grant or revoke it. Only a `granted` {@link AccessGrant}
 * counts; `pending`, `revoked`, or no row at all resolve to `false`. This is the
 * single enforcement point every gated feature checks, so adding a new gated
 * (or, later, paywalled) capability is a registry entry plus a call here.
 *
 * @param scope the organization + project the request belongs to
 * @param capability the gated capability to check
 */
export async function entitlementGranted(scope: AccessScope, capability: AccessCapability): Promise<boolean> {
  const grant = await AccessGrant.where({
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    capability,
    status: 'granted',
  }).first()

  return grant != null
}

/**
 * Whether AI document processing is enabled for a project. Thin wrapper over
 * {@link entitlementGranted} for the `ai` capability, kept so OCR resolution
 * (`resolveOcrDriver` in `@app/services/providers`) reads clearly.
 */
export function aiOcrEnabledForProject(scope: AccessScope): Promise<boolean> {
  return entitlementGranted(scope, 'ai')
}

/**
 * The project's PII entitlement, or null when not granted. Returns the granted
 * grant's {@link AccessGrantDetails} (requested categories + timing) so a future
 * caller exposing extracted PII can honor exactly what was approved. Not yet
 * wired to any response; the data-exposure step is a follow-up.
 */
export async function piiAccess(
  scope: AccessScope,
): Promise<{ granted: true; details: AccessGrantDetails | null } | null> {
  const grant = await AccessGrant.where({
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    capability: 'pii',
    status: 'granted',
  }).first()

  return grant ? { granted: true, details: grant.details } : null
}
