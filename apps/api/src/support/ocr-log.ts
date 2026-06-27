import { appendFile, mkdir } from 'node:fs/promises'

import { Arkstack } from '@arkstack/contract'
import { config } from '@arkstack/common'
import path from 'node:path'

/** Environments in which OCR extraction is logged to `storage/logs/ocr.log`. */
const DEBUG_ENVS = new Set(['local', 'development'])

/** Whether OCR debug logging is enabled (local/development only). */
function debugEnabled(): boolean {
  return DEBUG_ENVS.has(config('app.name', 'Arkyc'))
}

/** What was fed to the OCR driver, and what it returned. */
export interface OcrLogEntry {
  sessionId: string
  documentType: string | null
  country: string | null
  frontBytes: number
  backBytes: number
  result: { fields: unknown; confidence: number; raw: unknown }
}

/**
 * Append an OCR extraction record to `storage/logs/ocr.log` as a JSON line, for
 * debugging why fields come back empty (image sizes, recognized text, parse stage,
 * extracted fields, confidence). Gated to `APP_ENV` local/development and
 * best-effort: a logging failure never breaks the OCR job.
 */
export async function logOcrExtraction(entry: OcrLogEntry): Promise<void> {
  if (!debugEnabled()) return
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n'
  const dir = path.join(Arkstack.rootDir(), 'storage', 'logs')
  try {
    await mkdir(dir, { recursive: true })
    await appendFile(path.join(dir, 'ocr.log'), line, 'utf8')
  } catch {
    // Best-effort: never fail extraction because debug logging couldn't write.
  }
}
