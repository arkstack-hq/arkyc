/**
 * Coarse desktop/mobile detection used to decide whether to offer cross-device
 * handoff. Handoff is most useful when the user starts on a desktop (no good
 * camera) and continues on a phone, so projects can restrict it to desktops.
 */
export function isDesktopDevice(nav: Navigator): boolean {
  const ua = nav.userAgent || ''
  const mobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile|BlackBerry|Windows Phone/i.test(ua)
  // iPadOS 13+ masquerades as desktop Safari but reports touch points.
  const iPadOS = nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1
  return !mobile && !iPadOS
}
