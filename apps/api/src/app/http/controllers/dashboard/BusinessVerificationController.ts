import { HttpContext } from 'clear-router/types/express'
import type { FileLike } from '@arkstack/filesystem'
import type { BusinessVerificationDocument } from '@arkyc/types'
import { GenericResource } from 'resora'
import { BaseController } from '@controllers/BaseController'
import BusinessVerificationResource, { verificationPayload } from '@app/http/resources/BusinessVerificationResource'
import { audit } from '@app/services/AuditLogger'
import { businessVerifications } from '@app/services/BusinessVerificationService'
import { settings } from '@app/services/GlobalSettingsService'
import { readObject } from 'src/support/storage'

/** Rules for a business verification submission. */
export const BUSINESS_VERIFICATION_RULES = {
  legal_name: ['required', 'string', 'max:200'],
  country: ['required', 'string', 'alpha', 'size:2'],
  registration_number: ['required', 'string', 'max:100'],
  registered_address: ['required', 'string', 'max:500'],
  website: ['required', 'url'],
  dpo_name: ['required', 'string', 'max:200'],
  dpo_email: ['required', 'email'],
  privacy_policy_url: ['required', 'url'],
  data_protection_registration: ['nullable', 'string', 'max:100'],
  incorporation_document: ['required', 'file', 'mimes:.pdf,.png,.jpg,.jpeg', 'max:10240'],
  data_protection_document: ['nullable', 'file', 'mimes:.pdf,.png,.jpg,.jpeg', 'max:10240'],
}

const DOCUMENT_KINDS: BusinessVerificationDocument[] = ['incorporation', 'data_protection']

/** The active organization's business verification: status, submission and documents. */
export default class BusinessVerificationController extends BaseController {
  /**
   * The organization's status and latest submission.
   *
   * @param ctx
   * @returns
   */
  async show({ req }: HttpContext) {
    const organization = req.organization!
    const latest = await businessVerifications.latest(organization.id)

    return new GenericResource({
      status: organization.verificationStatus,
      verified_at: organization.verifiedAt ?? null,
      required: (await settings.current()).compliance.business_verification_required,
      can_go_live: await businessVerifications.canGoLive(organization),
      latest: latest ? verificationPayload(latest) : null,
    }).additional({
      status: 'success',
      message: 'OK',
      code: 200,
    })
  }

  /**
   * Submit business details and documents for review.
   *
   * @param ctx
   * @returns
   */
  async submit({ req }: HttpContext) {
    const data = await this.validate(BUSINESS_VERIFICATION_RULES)
    const organization = req.organization!

    const verification = await businessVerifications.submit(
      organization,
      req.user!.id,
      {
        legal_name: data.legal_name,
        country: data.country,
        registration_number: data.registration_number,
        registered_address: data.registered_address,
        website: data.website,
        dpo_name: data.dpo_name,
        dpo_email: data.dpo_email,
        privacy_policy_url: data.privacy_policy_url,
        data_protection_registration: data.data_protection_registration ?? null,
      },
      {
        incorporation: data.incorporation_document as FileLike,
        data_protection: (data.data_protection_document as FileLike | undefined) ?? undefined,
      },
    )

    await audit.recordForRequest(req, {
      action: 'organization.verification_submitted',
      entityType: 'organization',
      entityId: organization.id,
      metadata: { verification_id: verification.id },
    })

    return new BusinessVerificationResource(verification)
      .additional({
        status: 'success',
        message: 'Verification submitted',
        code: 201,
      })
      .response()
      .setStatusCode(201)
  }

  /**
   * Stream a document from the latest submission.
   *
   * @param ctx
   * @returns
   */
  async document({ req, res }: HttpContext) {
    const kind = req.params.kind as BusinessVerificationDocument
    const latest = await businessVerifications.latest(req.organization!.id)
    const path = DOCUMENT_KINDS.includes(kind) ? latest?.documentPath(kind) : null

    return streamDocument(res, path)
  }
}

/**
 * Send a stored verification document, or a 404.
 *
 * @param res
 * @param path
 * @returns
 */
export async function streamDocument(res: HttpContext['res'], path: string | null | undefined) {
  const bytes = await readObject(path)

  if (!path || !bytes.length) return res.status(404).json({ status: 'error', message: 'Document not found', code: 404 })

  const type = path.endsWith('.pdf') ? 'application/pdf' : path.endsWith('.png') ? 'image/png' : 'image/jpeg'

  return res.status(200).set('Content-Type', type).set('Cache-Control', 'private, no-store').send(Buffer.from(bytes))
}
