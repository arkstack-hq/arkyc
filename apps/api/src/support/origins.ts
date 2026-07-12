/** Normalize an origin for comparison: trimmed, lowercased, no trailing slash. */
export function normalizeOrigin(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, '')
}

/**
 * Opt-in per-project origin allowlist check. Allowed when:
 * - the project configured no origins (enforcement is opt-in — an empty list
 *   never blocks, so existing integrations keep working), or
 * - the request carries no `Origin` header (non-browser / same-origin call —
 *   there is nothing to enforce against).
 *
 * Otherwise the `Origin` header must match one of the allowlist entries.
 */
export function isOriginAllowed(
  allowed: readonly string[] | undefined | null,
  origin: string | undefined | null,
): boolean {
  if (!allowed || allowed.length === 0) return true
  if (!origin) return true

  const candidate = normalizeOrigin(origin)

  return allowed.some((entry) => normalizeOrigin(entry) === candidate)
}
