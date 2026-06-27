import type { Entity, Id, IsoDate, ProjectScoped } from './common'
import type { AddressMethod } from './workflow'

/** Supported identity document categories. */
export type DocumentType = 'passport' | 'id_card' | 'drivers_license' | 'residence_permit'

/** Structured identity fields extracted from a document via OCR. */
export interface OcrFields {
  firstName?: string
  lastName?: string
  fullName?: string
  dateOfBirth?: IsoDate
  documentNumber?: string
  expiryDate?: IsoDate
  nationality?: string
}

/**
 * Best-effort, image-only authenticity read from an OCR driver capable of it
 * (the `ai` vision driver). Advisory anti-spoofing signals — a flagged document
 * is routed to manual review, never auto-rejected on the model's say-so.
 */
export interface OcrAuthenticity {
  /** False when any tamper/replay signal fired. */
  genuine: boolean
  /** Model's authenticity confidence in [0, 1]: 1 = clearly an original, 0 = clearly fake/replayed. */
  confidence: number
  /** Looks like a photo of a screen (moiré, screen glare/banding, bezel) — a replay attack. */
  screenReplay: boolean
  /** Looks like a photo/scan of a printout or photocopy rather than the physical document. */
  photocopy: boolean
  /** Signs of digital editing (mismatched fonts, misaligned/recoloured text, cloned regions, edited photo/dates). */
  digitalTampering: boolean
  /** Signs of physical tampering (substituted photo, peeled laminate, scratched/overwritten fields). */
  physicalTampering: boolean
  /** Brief human-readable observations supporting the flags. */
  observations: string[]
}

/** The shape returned by any OCR driver. */
export interface OcrResultData {
  fields: OcrFields
  /** Overall extraction confidence in [0, 1]. */
  confidence: number
  /** Best-effort authenticity assessment, when the driver supports it. */
  authenticity?: OcrAuthenticity
  /** Raw provider payload, retained for audit/debugging. */
  raw?: unknown
}

/** Anti-spoofing signals surfaced by a liveness driver. */
export interface SpoofSignals {
  screenReplay?: boolean
  printedPhoto?: boolean
  maskDetected?: boolean
  multipleFaces?: boolean
  faceNotCentered?: boolean
  poorLighting?: boolean
}

/** The shape returned by any passive-liveness driver. */
export interface LivenessResultData {
  passed: boolean
  /** Liveness confidence in [0, 1]. */
  score: number
  spoofSignals: SpoofSignals
  raw?: unknown
}

/** The shape returned by any face-match driver. */
export interface FaceMatchResultData {
  passed: boolean
  /** Similarity between document portrait and selfie in [0, 1]. */
  similarityScore: number
  /** Driver confidence in the comparison, in [0, 1]. */
  confidence: number
  raw?: unknown
}

/** A normalized postal address. Any field may be absent depending on the source. */
export interface PostalAddress {
  line1?: string
  line2?: string
  city?: string
  /** State / province / region. */
  region?: string
  postalCode?: string
  /** Country as resolved (ISO code or name). */
  country?: string
  /** Geocoordinates, when a method resolves them. */
  latitude?: number
  longitude?: number
}

/** One method's contribution to address verification. */
export interface AddressMethodResult {
  method: AddressMethod
  /** Whether this method produced a usable, valid result. */
  passed: boolean
  /** Method confidence in [0, 1]. */
  confidence: number
  /** The address this method resolved/extracted, when any. */
  resolved?: PostalAddress
  /**
   * The provider's full, human-readable address string for the resolved hit —
   * e.g. Nominatim's `display_name` or openrouteservice's `label`. Shown to
   * reviewers so they see the exact place the provider detected.
   */
  resolvedLabel?: string
  /** Human-readable note (e.g. why it failed). */
  note?: string
  raw?: unknown
}

/** The shape returned by an address verifier — the aggregate of its methods. */
export interface AddressResultData {
  passed: boolean
  /** Overall confidence in [0, 1]. */
  score: number
  /** Per-method breakdown. */
  methods: AddressMethodResult[]
  /** Whether the methods agree (country/locality) when two or more ran. */
  consistent: boolean
  raw?: unknown
}

/** A captured identity document (front and optional back) for a session. */
export interface DocumentCapture extends Entity, ProjectScoped {
  session_id: Id
  country: string | null
  document_type: DocumentType | null
  front_image_path: string | null
  back_image_path: string | null
  quality_score: number | null
}

/** Persisted OCR output for a document capture. */
export interface OcrResult extends Entity, ProjectScoped {
  session_id: Id
  document_capture_id: Id
  fields: OcrFields
  confidence: number
  raw_response: unknown
}

/** The portrait region extracted from a document, used for face matching. */
export interface DocumentPortrait extends Entity, ProjectScoped {
  session_id: Id
  document_capture_id: Id
  portrait_image_path: string
  detection_confidence: number
}

/** Persisted passive-liveness result for a session. */
export interface LivenessCheck extends Entity, ProjectScoped {
  session_id: Id
  selfie_image_path: string | null
  video_path: string | null
  score: number
  passed: boolean
  spoof_signals: SpoofSignals
  provider: string
  raw_response: unknown
}

/** Persisted face-match result comparing document portrait to selfie. */
export interface FaceMatchCheck extends Entity, ProjectScoped {
  session_id: Id
  id_portrait_image_path: string | null
  selfie_image_path: string | null
  similarity_score: number
  confidence: number
  passed: boolean
  provider: string
  raw_response: unknown
}

/** Persisted address-verification result for a session. */
export interface AddressVerification extends Entity, ProjectScoped {
  session_id: Id
  /** The address the user claimed (typed in the widget), when provided. */
  claimed_address: PostalAddress | null
  /** Proof-of-address document image, when the `poa_document` method ran. */
  document_image_path: string | null
  /** Captured device coordinates, when the `device_location` method ran. */
  latitude: number | null
  longitude: number | null
  passed: boolean
  /** Overall confidence in [0, 1]. */
  score: number
  /** Per-method breakdown. */
  methods: AddressMethodResult[]
  provider: string
  raw_response: unknown
}
