/**
 * The Arkyc brand mark: the faceted gold "A". Served from `public/` so it stays
 * on-brand on any surface; size via `className` (e.g. `size-8`).
 */
export function Logo({ className }: { className?: string }) {
  return <img src="/arkyc-logo.png" className={className} alt="Arkyc" />
}
