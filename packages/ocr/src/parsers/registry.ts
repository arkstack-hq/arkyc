import type { DocumentType } from '@arkyc/types'
import type { DocumentParser, ParseInput, ParseOutput } from './types'
import { mrzParser } from './mrz'
import { genericTextParser } from './generic'

function eqCountry(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase()
}

/**
 * Specificity score for a parser against the user's selection, or -1 if it does
 * not apply. A parser scoped to a country scores higher than one scoped only to a
 * document type, so the most specific applicable parser wins.
 */
function matchScore(parser: DocumentParser, country?: string | null, documentType?: DocumentType | null): number {
  const scopedCountries = parser.countries?.length ? parser.countries : null
  const scopedTypes = parser.documentTypes?.length ? parser.documentTypes : null

  const countryOk = !scopedCountries || (!!country && scopedCountries.some((c) => eqCountry(c, country)))
  const typeOk = !scopedTypes || (!!documentType && scopedTypes.includes(documentType))
  if (!countryOk || !typeOk) return -1

  return (scopedCountries ? 2 : 0) + (scopedTypes ? 1 : 0)
}

/** Which stage of the pipeline produced a parse result. */
export type ParseStage = 'mrz' | 'custom' | 'generic'

/**
 * A registry of document parsers, resolved in three stages for each document:
 *
 *  1. **MRZ** — the machine-readable zone (reliable, check-digit-verified) when present.
 *  2. **Custom** — country/document-type-specific parsers (registered via {@link register}),
 *     matched against the user's selection (most specific first) when the MRZ fails.
 *  3. **Generic** — a best-effort text scraper, the last resort.
 *
 * Custom parsers declare the countries and document types they apply to; register
 * one per document layout the MRZ + generic stages can't read.
 */
export class DocumentParserRegistry {
  private readonly parsers: DocumentParser[] = []

  /**
   * @param primary  Tried first for every document (the MRZ parser).
   * @param fallback Tried last when nothing else extracts anything (generic).
   */
  constructor(
    private readonly primary: DocumentParser,
    private readonly fallback: DocumentParser,
  ) {}

  /** Register a custom country/type-specific parser. Returns `this` for chaining. */
  register(parser: DocumentParser): this {
    this.parsers.push(parser)
    return this
  }

  /** The applicable custom parsers for a selection, most specific first. */
  candidates(country?: string | null, documentType?: DocumentType | null): DocumentParser[] {
    return this.parsers
      .map((parser, index) => ({ parser, index, score: matchScore(parser, country, documentType) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.parser)
  }

  /**
   * Parse fields from OCR text: MRZ first, then the matched custom parsers, then
   * the generic fallback. Always returns a result (empty fields, confidence 0,
   * when nothing could parse).
   */
  parse(input: ParseInput): ParseOutput {
    // 1. MRZ — the gold standard when a machine-readable zone is present.
    const fromMrz = this.primary.parse(input)
    if (fromMrz) return tag(fromMrz, this.primary.name, 'mrz')

    // 2. Custom country/type-specific parsers, most specific first.
    for (const parser of this.candidates(input.country, input.documentType)) {
      const out = parser.parse(input)
      if (out) return tag(out, parser.name, 'custom')
    }

    // 3. Generic best-effort extraction.
    const fromGeneric = this.fallback.parse(input)
    if (fromGeneric) return tag(fromGeneric, this.fallback.name, 'generic')

    return { fields: {}, confidence: 0, raw: { parser: 'none' } }
  }
}

/** Annotate a parse result with which parser + stage produced it. */
function tag(out: ParseOutput, parser: string, stage: ParseStage): ParseOutput {
  const detail = out.raw && typeof out.raw === 'object' ? out.raw : { value: out.raw }
  return { ...out, raw: { parser, stage, ...detail } }
}

/**
 * Create a registry with the MRZ parser as the primary stage and the generic text
 * parser as the fallback. Register country/document-type-specific custom parsers
 * on top for documents the MRZ + generic stages can't read.
 */
export function createDocumentParserRegistry(
  options: { primary?: DocumentParser; fallback?: DocumentParser } = {},
): DocumentParserRegistry {
  return new DocumentParserRegistry(options.primary ?? mrzParser(), options.fallback ?? genericTextParser())
}
