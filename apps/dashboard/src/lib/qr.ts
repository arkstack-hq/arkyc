import qrcode from 'qrcode-generator'

/**
 * Encode `text` as a QR code and return a self-contained, scalable SVG string
 * (black modules on white) suitable for injecting via `dangerouslySetInnerHTML`.
 * Type number 0 auto-sizes to the data; error-correction level "M" tolerates
 * camera noise while staying dense enough to scan from a screen.
 */
export function renderQrSvg(text: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()

  return qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true })
}
