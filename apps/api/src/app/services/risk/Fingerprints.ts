import { createHmac } from 'node:crypto'
import { env } from '@arkstack/common'
import { toAlpha2 } from '@arkyc/network'
import type { DocumentType, OcrFields } from '@arkyc/types'

/**
 * Keyed hashes that identify a document or a person without storing either.
 * The key is derived from `APP_KEY`, so hashes can't be reversed by brute force
 * without it, and rotating `APP_KEY` starts duplicate detection afresh.
 */
export class Fingerprints {
  private static cachedKey: Buffer | null = null

  /**
   * Hash of the issuing country, document type and number, or `null` without a number.
   *
   * @param fields
   * @param country
   * @param documentType
   * @returns
   */
  static document(fields: OcrFields, country: string | null, documentType: DocumentType | null): string | null {
    const number = fields.documentNumber?.toUpperCase().replace(/[^A-Z0-9]/g, '')

    if (!number) return null

    const issuer = toAlpha2(country) ?? toAlpha2(fields.nationality) ?? ''

    return Fingerprints.hash(`document:${issuer}:${documentType ?? ''}:${number}`)
  }

  /**
   * Hash of the normalized name and date of birth, or `null` without both.
   *
   * @param fields
   * @param name
   * @returns
   */
  static identity(name: string | null, dateOfBirth: string | undefined): string | null {
    if (!name || !dateOfBirth) return null

    const tokens = name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean)
      .sort()

    if (!tokens.length) return null

    return Fingerprints.hash(`identity:${tokens.join(' ')}:${dateOfBirth.slice(0, 10)}`)
  }

  private static hash(value: string): string {
    return createHmac('sha256', Fingerprints.key()).update(value).digest('hex')
  }

  private static key(): Buffer {
    if (!Fingerprints.cachedKey) {
      const appKey = env('APP_KEY')

      if (!appKey) throw new Error('APP_KEY must be set to fingerprint documents')

      Fingerprints.cachedKey = createHmac('sha256', appKey).update('arkyc:fingerprints:v1').digest()
    }

    return Fingerprints.cachedKey
  }
}
