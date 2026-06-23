import type { DocumentType } from '@arkyc/types'
import type { DocumentParser, ParseInput, ParseOutput } from './types'
import { mrzParser } from './mrz'

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

/**
 * A registry of {@link DocumentParser}s. Parsers declare the countries and
 * document types they apply to; {@link DocumentParserRegistry.parse} matches those
 * against the user's selection, tries the most specific applicable parsers first,
 * and falls back to the default parser when none match (or none can parse).
 */
export class DocumentParserRegistry {
  private readonly parsers: DocumentParser[] = []

  /** @param fallback Used when no registered parser matches or can parse. */
  constructor(private readonly fallback: DocumentParser) {}

  /** Register a parser. Returns `this` for chaining. */
  register(parser: DocumentParser): this {
    this.parsers.push(parser)
    return this
  }

  /** The applicable parsers for a selection, most specific first. */
  candidates(country?: string | null, documentType?: DocumentType | null): DocumentParser[] {
    return this.parsers
      .map((parser, index) => ({ parser, index, score: matchScore(parser, country, documentType) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((entry) => entry.parser)
  }

  /**
   * Parse fields from OCR text, using the best-matching parser. Tries each
   * applicable parser in specificity order, then the fallback. Always returns a
   * result (empty fields with confidence 0 if nothing could parse).
   */
  parse(input: ParseInput): ParseOutput {
    for (const parser of this.candidates(input.country, input.documentType)) {
      const out = parser.parse(input)
      if (out) return tag(out, parser.name, false)
    }
    const fb = this.fallback.parse(input)
    if (fb) return tag(fb, this.fallback.name, true)
    return { fields: {}, confidence: 0, raw: { parser: 'none' } }
  }
}

/** Annotate a parse result with which parser produced it. */
function tag(out: ParseOutput, parser: string, fallback: boolean): ParseOutput {
  const detail = out.raw && typeof out.raw === 'object' ? out.raw : { value: out.raw }
  return { ...out, raw: { parser, fallback, ...detail } }
}

/**
 * Create a registry seeded with the MRZ parser as the default fallback (it works
 * across countries for machine-readable documents). Register country/type-specific
 * parsers on top for documents the MRZ default can't read.
 */
export function createDocumentParserRegistry(fallback: DocumentParser = mrzParser()): DocumentParserRegistry {
  return new DocumentParserRegistry(fallback)
}
