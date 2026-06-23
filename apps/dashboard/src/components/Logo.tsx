/**
 * The Arkstack brand mark: a faceted gold "A" monogram. Two-tone gold with a
 * detached lower-right chevron, echoing the product logo. Colour is baked in
 * (not theme-driven) so it stays on-brand on any surface; size via `className`.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="Arkstack"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left face of the A (deep gold) */}
      <polygon points="256,52 168,452 80,452" fill="#a9780a" />
      {/* Right face of the A (bright gold) */}
      <polygon points="256,52 344,452 432,452" fill="#e2a93b" />
      {/* Crossbar */}
      <polygon points="188,300 324,300 338,360 174,360" fill="#c99211" />
      {/* Detached chevron, bottom-right */}
      <polygon points="356,392 452,392 424,452 328,452" fill="#f0b829" />
    </svg>
  )
}
