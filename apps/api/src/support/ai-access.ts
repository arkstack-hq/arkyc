import { AiProcessingGrant } from '@app/models/AiProcessingGrant'

/**
 * Whether AI document processing is enabled for a project.
 *
 * AI OCR is a gated capability rather than a default-on feature: project owners
 * request access and platform admins grant or revoke it. When a project isn't
 * granted access, OCR resolution falls back to `OCR_FALLBACK_DRIVER` (see
 * `resolveOcrDriver` in `@app/services/providers`).
 *
 * Enabled only when the project has a `granted` {@link AiProcessingGrant};
 * `pending`, `revoked`, or no record at all all resolve to the fallback driver.
 *
 * @param scope the session's organization + project the request belongs to
 */
export async function aiOcrEnabledForProject(scope: { organizationId: string; projectId: string }): Promise<boolean> {
  const grant = await AiProcessingGrant.where({
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    status: 'granted',
  }).first()

  return grant != null
}
