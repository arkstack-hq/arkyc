import { Model } from 'arkormx'
import type { CastMap } from 'arkormx'
import type { AddressMethodResult, PostalAddress } from '@arkyc/types'
import { Organization } from './Organization'
import { Project } from './Project'
import { VerificationSession } from './VerificationSession'

export class AddressVerification extends Model {
  protected static override table = 'address_verifications'

  declare id: string
  declare organizationId: string
  declare projectId: string
  declare sessionId: string
  declare claimedAddress: PostalAddress | null
  declare documentImagePath: string | null
  declare latitude: number | null
  declare longitude: number | null
  declare passed: boolean
  declare score: number
  declare methods: AddressMethodResult[]
  declare provider: string
  declare rawResponse: unknown
  declare createdAt: Date
  declare updatedAt: Date

  protected static override columns = {
    organizationId: 'organization_id',
    projectId: 'project_id',
    sessionId: 'session_id',
    claimedAddress: 'claimed_address',
    documentImagePath: 'document_image_path',
    rawResponse: 'raw_response',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }

  protected override casts: CastMap = {
    claimedAddress: 'json',
    methods: 'json',
    rawResponse: 'json',
    passed: 'boolean',
  }

  organization() {
    return this.belongsTo(Organization, 'organizationId')
  }

  project() {
    return this.belongsTo(Project, 'projectId')
  }

  session() {
    return this.belongsTo(VerificationSession, 'sessionId')
  }
}
