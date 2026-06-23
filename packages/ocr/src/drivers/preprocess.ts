/**
 * Transforms raw image bytes to improve OCR legibility. Returns the (possibly
 * unchanged) bytes — a preprocessor must never throw; on failure it returns the
 * input so recognition still runs.
 */
export type OcrPreprocessor = (image: Uint8Array) => Promise<Uint8Array>

/** Tunables for the default {@link sharpPreprocessor}. */
export interface PreprocessOptions {
  /**
   * Upscale images narrower than this (px) to give the engine more pixels per
   * glyph — the single biggest win for the small OCR-B MRZ band. Default 1600.
   */
  minWidth?: number
}

/** A no-op preprocessor: passes the original bytes through unchanged. */
export const passthrough: OcrPreprocessor = async (image) => image

/** Minimal structural type for the lazily-imported `sharp` module. */
interface SharpInstance {
  metadata(): Promise<{ width?: number; height?: number }>
  grayscale(): SharpInstance
  normalise(): SharpInstance
  median(size: number): SharpInstance
  sharpen(): SharpInstance
  resize(options: { width: number; withoutEnlargement: boolean }): SharpInstance
  png(): SharpInstance
  toBuffer(): Promise<Buffer>
}
type SharpFactory = (input: Buffer) => SharpInstance

/**
 * Build a preprocessor over an injected `sharp` factory: grayscale → contrast
 * normalise → light denoise → sharpen → upscale small images. This lifts faint
 * document text and the OCR-B MRZ band without the aggressive binarisation that
 * destroys detail under uneven lighting. Any failure falls back to the original.
 */
export function buildSharpPreprocessor(sharp: SharpFactory, options: PreprocessOptions = {}): OcrPreprocessor {
  const minWidth = options.minWidth ?? 1600
  return async (image) => {
    try {
      const input = Buffer.from(image)
      const base = sharp(input)
      const { width } = await base.metadata()
      let pipe = sharp(input).grayscale().normalise().median(1).sharpen()
      if (width && width < minWidth) {
        pipe = pipe.resize({ width: minWidth, withoutEnlargement: false })
      }
      const out = await pipe.png().toBuffer()
      return new Uint8Array(out)
    } catch {
      return image
    }
  }
}

let cached: OcrPreprocessor | undefined

/**
 * The default preprocessor, backed by the optional `sharp` package and resolved
 * once. If `sharp` isn't installed it degrades to {@link passthrough}, so OCR
 * still runs on the raw bytes (just without the legibility boost).
 */
export async function defaultPreprocessor(options: PreprocessOptions = {}): Promise<OcrPreprocessor> {
  if (cached) return cached
  const moduleName = 'sharp'
  try {
    const mod = (await import(/* @vite-ignore */ moduleName)) as unknown as { default: SharpFactory }
    cached = buildSharpPreprocessor(mod.default, options)
  } catch {
    cached = passthrough
  }
  return cached
}
