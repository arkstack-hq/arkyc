import { Job } from '@arkstack/jobs'
import { Storage } from '@arkstack/filesystem'
import { ocrDriver } from '@app/services/providers'
import { readObject, sessionObjectKey } from 'src/support/storage'
import { VerificationSession } from '@app/models/VerificationSession'
import { DocumentCapture } from '@app/models/DocumentCapture'
import { OcrResult } from '@app/models/OcrResult'
import { DocumentPortrait } from '@app/models/DocumentPortrait'

/** Confidence reported for the (mock) portrait extraction off the document. */
const PORTRAIT_DETECTION_CONFIDENCE = 0.95

export interface OcrJobHints {
  ocrConfidence?: number
  expired?: boolean
}

/**
 * OCR job (queue `ocr`): reads the stored document front, runs the OCR driver
 * + portrait extraction, and persists the results. Idempotent — a re-delivery
 * after the OCR result exists is a no-op.
 */
export class OcrJob extends Job {
  override queue = 'ocr'
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
    const ocr = await ocrDriver.extract({
      image,
      backImage: back.length ? back : undefined,
      documentType: capture.documentType,
      country: capture.country,
      hints: { confidence: this.hints.ocrConfidence, expired: this.hints.expired },
    })
    await OcrResult.create({
      tenantId: session.tenantId,
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
      tenantId: session.tenantId,
      projectId: session.projectId,
      sessionId: session.id,
      documentCaptureId: capture.id,
      portraitImagePath: portraitPath,
      detectionConfidence: PORTRAIT_DETECTION_CONFIDENCE,
    })
  }
}
