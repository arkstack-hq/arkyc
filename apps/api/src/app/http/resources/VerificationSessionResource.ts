import { Resource } from 'resora'

/** A verification session as seen by the integrating backend (Public API). */
export default class VerificationSessionResource extends Resource {
  /** Signed inline-image URLs for captured assets (attached on single-session retrieve). */
  private assets: Record<string, string> | null = null
  /** Extracted PII, attached only when the project holds a granted `pii` entitlement. */
  private extracted: object | null = null

  /** Attach signed asset URLs to this resource (chainable). */
  withAssets(assets: Record<string, string> | null): this {
    this.assets = assets

    return this
  }

  /** Attach extracted PII (gated by the `pii` entitlement) to this resource (chainable). */
  withExtracted(extracted: object | null): this {
    this.extracted = extracted

    return this
  }

  /**
   * Person's name from the document, when the OCR relation is eager-loaded
   * (dashboard list). Prefers `fullName`, else `firstName lastName`; null when no
   * OCR is loaded or no name was extracted.
   */
  private personName(): string | null {
    const rel = this.resource.getAttribute('ocrResults') as Iterable<{ getAttribute(k: string): unknown }> | undefined
    if (!rel) return null
    for (const ocr of Array.from(rel).reverse()) {
      const fields = ocr.getAttribute('fields') as
        | { firstName?: string; lastName?: string; fullName?: string }
        | null
        | undefined
      if (!fields) continue
      const name =
        (fields.fullName ?? '').trim() || [fields.firstName, fields.lastName].filter(Boolean).join(' ').trim()
      if (name) return name
    }

    return null
  }

  data() {
    return {
      id: this.id,
      project_id: this.projectId,
      user_reference: this.userReference ?? null,
      name: this.personName(),
      status: this.status,
      auto_decision: this.autoDecision ?? null,
      final_decision: this.finalDecision ?? null,
      decision_reason: this.decisionReason ?? null,
      risk_score: this.riskScore ?? null,
      assigned_to: this.assignedTo ?? null,
      workflow_id: this.workflowId ?? null,
      workflow: this.workflow ?? null,
      assets: this.assets,
      extracted: this.extracted,
      expires_at: this.expiresAt,
      completed_at: this.completedAt ?? null,
      created_at: this.createdAt,
    }
  }
}
