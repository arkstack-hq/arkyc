import { Job } from '@arkstack/jobs'
import { Storage } from '@arkstack/filesystem'
import { fallbackOcrDriver, resolveOcrDriver } from '@app/services/providers'
import { Logger } from '@arkstack/common'
import type { OcrFields, OcrResultData } from '@arkyc/types'
import { readObject, sessionObjectKey } from 'src/support/storage'
import { aiOcrEnabledForProject } from 'src/support/access'
import { logOcrExtraction } from 'src/support/ocr-log'
import { VerificationSession } from '@app/models/VerificationSession'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { OcrResult } from '@app/models/OcrResult'
import { DocumentPortrait } from '@app/models/DocumentPortrait'

/** Fields that identify the person; a result with none of them read nothing useful. */
const IDENTITY_FIELDS: (keyof OcrFields)[] = ['firstName', 'lastName', 'fullName', 'documentNumber', 'dateOfBirth']

const readAnything = (fields: OcrFields): boolean => IDENTITY_FIELDS.some((key) => Boolean(fields[key]))

/** A read missing any of these (a name, the number, the birth date) is topped up by the fallback. */
const missingCore = (fields: OcrFields): boolean =>
  !(fields.firstName || fields.lastName || fields.fullName) || !fields.documentNumber || !fields.dateOfBirth

/** `primary`'s fields, with the gaps filled from `fallback`. */
const fillGaps = (primary: OcrFields, fallback: OcrFields): OcrFields => {
  const filled: OcrFields = { ...primary }

  for (const [key, value] of Object.entries(fallback) as [keyof OcrFields, string][]) {
    if (value && !filled[key]) (filled as Record<string, string>)[key] = value
  }

  return filled
}

/** Confidence reported for the (mock) portrait extraction off the document. */
const PORTRAIT_DETECTION_CONFIDENCE = 0.95

export interface OcrJobHints {
  ocrConfidence?: number
  expired?: boolean
  fullName?: string
  dateOfBirth?: string
  documentNumber?: string
}

/**
 * OCR job (queue `queue.queues.ocr`): reads the stored document front, runs the OCR driver
 * + portrait extraction, and persists the results. Idempotent — a re-delivery
 * after the OCR result exists is a no-op.
 */
export class OcrJob extends Job {
  override queue = config('queue.queues.ocr', 'ocr')
  override tries = 3

  constructor(
    public sessionId: string,
    public hints: OcrJobHints = {},
  ) {
    super()
  }

  async handle(): Promise<void> {
    const session = await VerificationSession.where({ id: this.sessionId }).first()

    if (!session) return

    if (await OcrResult.where({ sessionId: session.id }).first()) return

    const capture = await DocumentCapture.where({ sessionId: session.id }).first()

    if (!capture) return

    const image = await readObject(capture.frontImagePath)
    // Read the back too — the MRZ may be printed there (ID cards, residence permits).
    const back = capture.backImagePath ? await readObject(capture.backImagePath) : new Uint8Array(0)
    // AI processing is gated per project; fall back to OCR_FALLBACK_DRIVER when
    // it isn't granted (no-op for non-`ai` primaries).
    const aiEnabled = await aiOcrEnabledForProject(session)
    const request = {
      image,
      backImage: back.length ? back : undefined,
      documentType: capture.documentType,
      country: capture.country,
      hints: {
        confidence: this.hints.ocrConfidence,
        expired: this.hints.expired,
        fullName: this.hints.fullName,
        dateOfBirth: this.hints.dateOfBirth,
        documentNumber: this.hints.documentNumber,
      },
    }
    const ocr = await this.extract(resolveOcrDriver(aiEnabled), request, session.id)

    await logOcrExtraction({
      sessionId: session.id,
      documentType: capture.documentType,
      country: capture.country,
      frontBytes: image.length,
      backBytes: back.length,
      result: { fields: ocr.fields, confidence: ocr.confidence, raw: ocr.raw },
    })
    await OcrResult.create({
      organizationId: session.organizationId,
      projectId: session.projectId,
      sessionId: session.id,
      documentCaptureId: capture.id,
      fields: ocr.fields,
      confidence: ocr.confidence,
      rawResponse: ocr.raw,
    })

    // Persist the extracted portrait (the front image stands in for the mock)
    // for the downstream face-match step.
    const portraitPath = sessionObjectKey(session, 'documents/portrait.jpg')

    await Storage.disk().put(portraitPath, image, { visibility: 'private' })
    await DocumentPortrait.create({
      organizationId: session.organizationId,
      projectId: session.projectId,
      sessionId: session.id,
      documentCaptureId: capture.id,
      portraitImagePath: portraitPath,
      detectionConfidence: PORTRAIT_DETECTION_CONFIDENCE,
    })
  }

  /**
   * Run the primary OCR driver, falling back to OCR_FALLBACK_DRIVER when it fails
   * (e.g. a misconfigured AI provider) or reads no identity field (e.g. a model that
   * answers the tool call but leaves the fields empty). Without the fallback the job
   * fails and the decision waits forever on "OCR result is not ready yet". The
   * primary's authenticity read and raw payload are kept, so nothing is lost.
   *
   * A primary read that misses a name, the document number or the birth date
   * (e.g. a model that only read the date of birth off a NIN slip) is kept, and
   * the fallback fills only the fields it left empty.
   */
  private async extract(
    primary: ReturnType<typeof resolveOcrDriver>,
    request: Parameters<ReturnType<typeof resolveOcrDriver>['extract']>[0],
    sessionId: string,
  ): Promise<OcrResultData> {
    if (primary === fallbackOcrDriver) return primary.extract(request)

    let first: OcrResultData | null = null
    let reason: string

    try {
      first = await primary.extract(request)
      if (readAnything(first.fields))
        return missingCore(first.fields) ? this.topUp(primary, first, request, sessionId) : first
      reason = 'read no identity fields'
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error)
    }

    Logger.warn(
      `OcrJob ${sessionId}: ${primary.name} OCR ${reason}; falling back to ${fallbackOcrDriver.name}`,
      false,
      true,
    )
    const fallback = await fallbackOcrDriver.extract(request)

    return {
      ...fallback,
      authenticity: fallback.authenticity ?? first?.authenticity,
      raw: { fallbackFrom: primary.name, reason, primary: first?.raw ?? null, fallback: fallback.raw ?? null },
    }
  }

  /** Fill the fields `first` left empty from the fallback driver; keep `first` if that fails. */
  private async topUp(
    primary: ReturnType<typeof resolveOcrDriver>,
    first: OcrResultData,
    request: Parameters<ReturnType<typeof resolveOcrDriver>['extract']>[0],
    sessionId: string,
  ): Promise<OcrResultData> {
    let fallback: OcrResultData

    try {
      fallback = await fallbackOcrDriver.extract(request)
    } catch (error) {
      Logger.warn(`OcrJob ${sessionId}: ${fallbackOcrDriver.name} top-up failed: ${String(error)}`, false, true)

      return first
    }

    const fields = fillGaps(first.fields, fallback.fields)
    const added = (Object.keys(fields) as (keyof OcrFields)[]).filter((key) => !first.fields[key])

    if (!added.length) return first

    Logger.warn(
      `OcrJob ${sessionId}: ${primary.name} OCR missed ${added.join(', ')}; filled from ${fallbackOcrDriver.name}`,
      false,
      true,
    )

    return {
      ...first,
      fields,
      raw: { toppedUpFrom: fallbackOcrDriver.name, added, primary: first.raw ?? null, fallback: fallback.raw ?? null },
    }
  }
}
