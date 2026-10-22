import { HttpContext } from 'clear-router/types/express'
import { perPage } from '@arkstack/common'
import type { BusinessVerificationDocument } from '@arkyc/types'
import { GenericResource } from 'resora'
import { BaseController } from '@controllers/BaseController'
import { streamDocument } from '@controllers/dashboard/BusinessVerificationController'
import BusinessVerificationCollection from '@app/http/resources/BusinessVerificationCollection'
import BusinessVerificationResource from '@app/http/resources/BusinessVerificationResource'
import CountResource from '@app/http/resources/CountResource'
import OrganizationResource from '@app/http/resources/OrganizationResource'
import { BusinessVerification } from '@app/models/BusinessVerification'
import { Organization } from '@app/models/Organization'
import { businessVerifications } from '@app/services/BusinessVerificationService'
import { platformAudit } from '@app/services/PlatformAuditLogger'

const param = (value: unknown): string | undefined => (Array.isArray(value) ? value[0] : value) as string | undefined
const STATUSES = ['pending', 'approved', 'rejected']

/** Platform-admin review of business verifications. Gated by `admin.organizations.*`. */
export default class AdminBusinessVerificationController extends BaseController {
  /** Submissions, newest first; `?status=pending|approved|rejected` filters. */
  async index({ req }: HttpContext) {
    const status = param(req.query.status)
    const page = await BusinessVerification.query()
      .when(!!status && STATUSES.includes(status), (query) => query.where({ status: status! }))
      .with('organization')
      .latest('createdAt')
      .paginate(perPage(req.query))

    return new BusinessVerificationCollection(page).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** How many submissions await review (drives the nav badge). */
  async count() {
    const count = await BusinessVerification.where({ status: 'pending' }).count()

    return new CountResource({ count }).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** One submission with its organization. */
  async show({ req }: HttpContext) {
    const verification = await BusinessVerification.where({ id: req.params.id }).with('organization').firstOrFail()

    return new BusinessVerificationResource(verification).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /** Stream one of a submission's documents. */
  async document({ req, res }: HttpContext) {
    const verification = await BusinessVerification.where({ id: req.params.id }).firstOrFail()
    const kind = req.params.kind as BusinessVerificationDocument

    return streamDocument(
      res,
      ['incorporation', 'data_protection'].includes(kind) ? verification.documentPath(kind) : null,
    )
  }

  /** Approve a pending submission. */
  async approve({ req }: HttpContext) {
    const data = await this.validate({ note: ['nullable', 'string', 'max:2000'] })

    return this.decide(req, 'approved', data.note ?? null)
  }

  /** Reject a pending submission; the note tells the organization what to fix. */
  async reject({ req }: HttpContext) {
    const data = await this.validate({ note: ['required', 'string', 'max:2000'] })

    return this.decide(req, 'rejected', data.note)
  }

  /** Mark an organization verified or unverified directly, without a submission. */
  async setOrganizationStatus({ req }: HttpContext) {
    const data = await this.validate({ verified: ['required', 'boolean'] })
    const organization = await Organization.where({ id: req.params.organizationId }).firstOrFail()

    await businessVerifications.setVerified(organization, data.verified === true || data.verified === 'true')
    await platformAudit.recordForRequest(req, {
      action: 'organization.verification_set',
      entityType: 'organization',
      entityId: organization.id,
      metadata: { status: organization.verificationStatus },
    })

    return new OrganizationResource(organization)
      .additional({
        status: 'success',
        message: 'Verification updated',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  private async decide(req: HttpContext['req'], decision: 'approved' | 'rejected', note: string | null) {
    const verification = await BusinessVerification.where({ id: req.params.id }).firstOrFail()

    await businessVerifications.decide(verification, decision, req.user!.id, note)
    await platformAudit.recordForRequest(req, {
      action: `organization.verification_${decision}`,
      entityType: 'organization',
      entityId: verification.organizationId,
      metadata: { verification_id: verification.id, note },
    })

    return new GenericResource({ id: verification.id, status: decision })
      .additional({
        status: 'success',
        message: `Verification ${decision}`,
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }
}
