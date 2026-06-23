import { Resource } from 'resora'

/** A verification session as seen by the integrating backend (Public API). */
export default class VerificationSessionResource extends Resource {
  data() {
    return {
      id: this.id,
      project_id: this.projectId,
      user_reference: this.userReference ?? null,
      status: this.status,
      auto_decision: this.autoDecision ?? null,
      final_decision: this.finalDecision ?? null,
      decision_reason: this.decisionReason ?? null,
      risk_score: this.riskScore ?? null,
      assigned_to: this.assignedTo ?? null,
      workflow_id: this.workflowId ?? null,
      workflow: this.workflow ?? null,
      expires_at: this.expiresAt,
      completed_at: this.completedAt ?? null,
      created_at: this.createdAt,
    }
  }
}
