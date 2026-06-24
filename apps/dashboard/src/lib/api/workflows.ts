import type { Workflow, WorkflowOptions, WorkflowStep } from '@arkyc/types'
import { CACHE, alova, t, unwrap } from './client'

/** The editable fields of a workflow. */
export interface WorkflowInput {
  name: string
  steps: WorkflowStep[]
  options: WorkflowOptions
}

/** Organization-scoped verification workflows (ordered, toggleable stages + skip_ocr). */
export class Workflows {
  /** All workflows in the organization. */
  static list(organizationId: string) {
    return alova.Get(`${t(organizationId)}/workflows`, {
      name: 'workflows:list',
      cacheFor: CACHE,
      hitSource: ['workflow:create', 'workflow:update', 'workflow:delete'],
      transform: unwrap<Workflow[]>,
    })
  }

  /** Create a workflow. */
  static create(organizationId: string, input: WorkflowInput) {
    return alova.Post(`${t(organizationId)}/workflows`, input, {
      name: 'workflow:create',
      transform: unwrap<Workflow>,
    })
  }

  /** Update a workflow's name, stage order/toggles, or options. */
  static update(organizationId: string, workflowId: string, input: Partial<WorkflowInput>) {
    return alova.Patch(`${t(organizationId)}/workflows/${workflowId}`, input, {
      name: 'workflow:update',
      transform: unwrap<Workflow>,
    })
  }

  /** Delete a workflow. */
  static remove(organizationId: string, workflowId: string) {
    return alova.Delete(`${t(organizationId)}/workflows/${workflowId}`, undefined, { name: 'workflow:delete' })
  }
}
