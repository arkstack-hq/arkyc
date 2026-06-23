import type { DocumentType, OcrFields } from '@arkyc/types'

/** The OCR text + context handed to a document parser. */
export interface ParseInput {
  /** Full OCR text for the document (raw engine output). */
  text: string
  /** Pre-split lines; derived from `text` when omitted. */
  lines?: string[]
  /** The document category the user selected (matched against parsers). */
  documentType?: DocumentType | null
  /** The ISO country the user selected (matched against parsers). */
  country?: string | null
}

/** A parser's structured result. */
export interface ParseOutput {
  fields: OcrFields
  /** Confidence in this parse, 0–1. */
  confidence: number
  /** Anything worth retaining for audit (matched zone, raw lines, …). */
  raw?: unknown
}

/**
 * A document parser turns raw OCR text into structured {@link OcrFields}. A parser
 * declares the countries and document types it applies to; the registry matches
 * those against the user's selection to pick the most specific parser, and falls
 * back to the default when none match (or none can parse the text).
 */
export interface DocumentParser {
  readonly name: string
  /**
   * ISO-3166 country codes (alpha-2 or alpha-3) this parser applies to. Omit (or
   * leave empty) to apply to any country.
   */
  readonly countries?: readonly string[]
  /** Document types this parser applies to. Omit/empty to apply to any type. */
  readonly documentTypes?: readonly DocumentType[]
  /** Parse fields from the input, or return `null` if it can't handle it. */
  parse(input: ParseInput): ParseOutput | null
}
