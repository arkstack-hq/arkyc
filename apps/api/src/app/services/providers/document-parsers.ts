import type { DocumentParser } from '@arkyc/ocr'

/**
 * App-specific document parsers for the OCR pipeline.
 *
 * Each parser declares the countries + document types it applies to. For every
 * document the pipeline tries, in order:
 *   1. the MRZ (front or back),
 *   2. the most-specific matching parser registered here,
 *   3. a generic text scraper (dates + document number).
 *
 * Register a parser per document layout the MRZ/generic stages can't read — e.g.
 * the front of a national ID or a driver's licence. `parse` receives the combined
 * OCR text of both sides and returns structured fields, or `null` if it can't read it.
 *
 * Example:
 * ```ts
 * export const documentParsers: DocumentParser[] = [
 *   {
 *     name: 'ng-drivers-license',
 *     countries: ['NG'],
 *     documentTypes: ['drivers_license'],
 *     parse: ({ text }) => {
 *       const documentNumber = text.match(/\b[A-Z]{3}\d{6,}\b/)?.[0]
 *       if (!documentNumber) return null
 *       return { fields: { documentNumber }, confidence: 0.6 }
 *     },
 *   },
 * ]
 * ```
 */
export const documentParsers: DocumentParser[] = []
