import { HttpContext } from 'clear-router/types/express'
import { BaseController } from '@controllers/BaseController'
import { Workflow } from '@app/models/Workflow'
import WorkflowResource from '@app/http/resources/WorkflowResource'
import WorkflowCollection from '@app/http/resources/WorkflowCollection'
import { audit } from '@app/services/AuditLogger'
import { normalizeWorkflowOptions, normalizeWorkflowSteps } from 'src/support/workflow'

/**
 * Organization-scoped verification workflows. A workflow orders the coarse
 * verification stages, toggles them, and can skip OCR. It is shared across all
 * projects in the organization and applied to a session by passing its ID to
 * `new Arkyc({ workflowId })`. Gated by `workflows.*`.
 */
export default class WorkflowController extends BaseController {
  /** List the organization's workflows. */
  async index({ req }: HttpContext) {
    const workflows = await Workflow.where({ organizationId: req.organization!.id }).get()

    return new WorkflowCollection(workflows).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** Show a single workflow. */
  async show({ req }: HttpContext) {
    const workflow = await this.scoped(req)

    return new WorkflowResource(workflow).additional({ status: 'success', message: 'OK', code: 200 })
  }

  /** Create a workflow. */
  async create({ req }: HttpContext) {
    const data = await this.validate({
      name: ['required', 'string', 'max:120'],
      steps: ['required', 'array'],
      options: ['nullable'],
    })

    const workflow = await Workflow.create({
      organizationId: req.organization!.id,
      name: data.name,
      steps: normalizeWorkflowSteps(data.steps),
      options: normalizeWorkflowOptions(data.options),
    })

    await audit.recordForRequest(req, {
      action: 'workflow.created',
      entityType: 'workflow',
      entityId: workflow.id,
    })

    return new WorkflowResource(workflow)
      .additional({ status: 'success', message: 'Workflow created', code: 201 })
      .response()
      .setStatusCode(201)
  }

  /** Update a workflow's name, stage order/toggles, or options. */
  async update({ req }: HttpContext) {
    const workflow = await this.scoped(req)
    const data = await this.validate({
      name: ['nullable', 'string', 'max:120'],
      steps: ['nullable', 'array'],
      options: ['nullable'],
    })

    if (data.name != null) workflow.name = data.name
    if (data.steps != null) workflow.steps = normalizeWorkflowSteps(data.steps)
    if (data.options != null) workflow.options = normalizeWorkflowOptions(data.options)
    await workflow.save()

    await audit.recordForRequest(req, {
      action: 'workflow.updated',
      entityType: 'workflow',
      entityId: workflow.id,
    })

    return new WorkflowResource(workflow).additional({ status: 'success', message: 'Workflow updated', code: 200 })
  }

  /** Delete a workflow. In-flight sessions keep their snapshotted config. */
  async destroy({ req }: HttpContext) {
    const workflow = await this.scoped(req)
    await workflow.delete()

    await audit.recordForRequest(req, {
      action: 'workflow.deleted',
      entityType: 'workflow',
      entityId: workflow.id,
    })

    return new WorkflowResource(workflow).additional({ status: 'success', message: 'Workflow deleted', code: 200 })
  }

  /** Resolve the route's workflow, scoped to the active organization (404 otherwise). */
  private scoped(req: HttpContext['req']) {
    return Workflow.where({ id: req.params.workflowId, organizationId: req.organization!.id }).firstOrFail()
  }
}
