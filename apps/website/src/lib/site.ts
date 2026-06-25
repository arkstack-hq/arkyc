// The dashboard (hosted app) the marketing site links into for auth.
// Override per-environment with VITE_DASHBOARD_URL (e.g. https://app.arkyc.toneflix.net).
const DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL as string | undefined) ?? 'http://localhost:5173'

// The open-source / white-label documentation (separate VitePress site).
// Override per-environment with VITE_DOCS_URL.
const DOCS_URL = (import.meta.env.VITE_DOCS_URL as string | undefined) ?? 'https://docs.arkyc.toneflix.net'

export const links = {
  login: `${DASHBOARD_URL}/login`,
  signup: `${DASHBOARD_URL}/register`,
  docs: '/docs',
  github: 'https://github.com/arkstack-hq/arkyc',
  ossDocs: DOCS_URL,
}

export const primaryNav = [
  { label: 'Product', href: '/#features' },
  { label: 'How it works', href: '/#how' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Docs', href: '/docs' },
]
