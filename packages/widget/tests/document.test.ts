import { describe, expect, it } from 'vitest'
import { analyzeDocumentGray, documentGuidance, isDocumentReady } from '../src/document'

/** Build a grayscale frame with a bright rectangle on a dark background. */
function frameWithRect(
  w: number,
  h: number,
  box: { x0: number; y0: number; x1: number; y1: number },
  opts: { bg?: number; fg?: number; noise?: number } = {},
): Float32Array {
  const { bg = 30, fg = 220, noise = 0 } = opts
  const g = new Float32Array(w * h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const inside = x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1
      // Add a faint checker inside so the interior carries some high-frequency
      // detail (a real document is sharp, not perfectly flat).
      const detail = inside && noise ? ((x + y) % 2 === 0 ? noise : -noise) : 0
      g[y * w + x] = (inside ? fg : bg) + detail
    }
  }
  return g
}

const W = 160
const H = 100

describe('analyzeDocumentGray', () => {
  it('locates a centred bright rectangle and reports a plausible fill', () => {
    const s = analyzeDocumentGray(frameWithRect(W, H, { x0: 32, y0: 20, x1: 128, y1: 80 }, { noise: 10 }), W, H)
    expect(s.present).toBe(true)
    expect(s.centerX).toBeCloseTo(0.5, 1)
    expect(s.centerY).toBeCloseTo(0.5, 1)
    expect(s.fill).toBeGreaterThan(0.3)
    expect(s.fill).toBeLessThan(0.8)
    expect(s.edgeStrength).toBeGreaterThan(0.1)
  })

  it('reports no document for a flat, featureless frame', () => {
    const flat = new Float32Array(W * H).fill(120)
    const s = analyzeDocumentGray(flat, W, H)
    expect(s.present).toBe(false)
    expect(s.edgeStrength).toBeLessThan(0.04)
  })
})

describe('documentGuidance', () => {
  const good = () => analyzeDocumentGray(frameWithRect(W, H, { x0: 28, y0: 16, x1: 132, y1: 84 }, { noise: 12 }), W, H)

  it('is ready for a centred, framed, sharp document', () => {
    expect(isDocumentReady(good())).toBe(true)
  })

  it('asks to move closer when the document is small', () => {
    // Lighter background so overall brightness passes — the small size is the issue.
    const s = analyzeDocumentGray(frameWithRect(W, H, { x0: 64, y0: 40, x1: 96, y1: 60 }, { bg: 110, noise: 12 }), W, H)
    const g = documentGuidance(s)
    expect(g.ready).toBe(false)
    expect(g.hint).toMatch(/closer/i)
  })

  it('flags a too-dark frame', () => {
    const s = analyzeDocumentGray(frameWithRect(W, H, { x0: 28, y0: 16, x1: 132, y1: 84 }, { bg: 5, fg: 30 }), W, H)
    expect(documentGuidance(s).hint).toMatch(/dark/i)
  })
})
