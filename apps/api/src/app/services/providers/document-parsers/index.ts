import type { DocumentParser } from '@arkyc/ocr'
import { euDrivingLicenceParser } from './eu-driving-licence'
import { inAadhaarParser, inPanParser } from './india'
import { labelledFieldParser } from './labelled'
import { ngNinSlipParser } from './ng-nin-slip'
import { ngVoterCardParser } from './ng-voter-card'

/**
 * App-specific document parsers for the OCR pipeline.
 *
 * Each parser declares the countries + document types it applies to. For every
 * document the pipeline tries, in order:
 *   1. the MRZ (front or back): every passport and most modern ID cards,
 *   2. the most-specific matching parser registered here,
 *   3. a generic text scraper (dates + document number).
 *
 * Register a parser per document layout the MRZ/generic stages can't read — e.g.
 * the front of a national ID or a driver's licence. `parse` receives the combined
 * OCR text of both sides and returns structured fields, or `null` if it can't read
 * it, so the next candidate gets a turn. Layout parsers come before the
 * country-agnostic labelled-field parser, which is the last resort before the
 * generic scraper.
 */
export const documentParsers: DocumentParser[] = [
  ngVoterCardParser,
  ngNinSlipParser,
  euDrivingLicenceParser,
  inAadhaarParser,
  inPanParser,
  labelledFieldParser,
]

export { euDrivingLicenceParser, inAadhaarParser, inPanParser, labelledFieldParser, ngNinSlipParser, ngVoterCardParser }
