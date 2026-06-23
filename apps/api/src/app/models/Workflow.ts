import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { WorkflowOptions, WorkflowStep } from '@arkyc/types'
import { Organization } from './Organization'

/** An organization-scoped verification workflow (ordered, toggleable stages). */
export class Workflow extends Model {
  protected static override table = 'workflows'

  declare id: string
  declare organizationId: string
  declare name: string
  declare steps: WorkflowStep[]
  declare options: WorkflowOptions
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    steps: 'json',
    options: 'json',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }
}
