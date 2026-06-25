import { defineConfig, type HeadConfig } from 'vitepress'

// Deploy-time configuration (all optional; sensible defaults for local dev):
//  - DOCS_BASE         e.g. "/Arkyc/" for a GitHub Pages project site, "/" for a custom domain.
//  - DOCS_SITE_URL     canonical origin, used for sitemap + Open Graph absolute URLs.
//  - GA_MEASUREMENT_ID Google Analytics 4 id (e.g. "G-XXXXXXX"); analytics load only when set.
// Normalize to a leading + trailing slash (VitePress requires both), so a raw
// GitHub Pages base_path like "/Arkyc" works unchanged.
const base = `/${(process.env.DOCS_BASE || '').replace(/^\/|\/$/g, '')}/`.replace(/^\/\/$/, '/')
const siteUrl = (process.env.DOCS_SITE_URL || 'https://docs.arkyc.toneflix.net').replace(/\/$/, '')
const gaId = process.env.GA_MEASUREMENT_ID
const repo = 'https://github.com/arcstack/arkyc'

const description =
  'Open-source, multi-tenant identity verification — document capture, OCR, liveness, face match, decisioning, reviews, webhooks, SDK and widget.'

const head: HeadConfig[] = [
  ['link', { rel: 'icon', type: 'image/png', href: `${base}arkyc-icon.png` }],
  ['meta', { name: 'theme-color', content: '#e2a93b' }],
  ['meta', { name: 'description', content: description }],
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:site_name', content: 'Arkyc' }],
  ['meta', { property: 'og:title', content: 'Arkyc — Open-source identity verification' }],
  ['meta', { property: 'og:description', content: description }],
  ['meta', { property: 'og:url', content: `${siteUrl}/` }],
  ['meta', { name: 'twitter:card', content: 'summary' }],
  ['meta', { name: 'twitter:title', content: 'Arkyc — Open-source identity verification' }],
  ['meta', { name: 'twitter:description', content: description }],
]

// Google Analytics 4 — appended only when an id is configured (keeps dev/preview clean).
if (gaId) {
  head.push(
    ['script', { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${gaId}` }],
    [
      'script',
      {},
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
    ],
  )
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Arkyc',
  description,
  lastUpdated: true,
  cleanUrls: true,
  base,
  head,
  sitemap: { hostname: `${siteUrl}/` },

  themeConfig: {
    logo: '/arkyc-logo.png',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'Integrate', link: '/integrations/sdk' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Architecture', link: '/guide/architecture' },
          ],
        },
        {
          text: 'Concepts',
          items: [
            { text: 'Multi-tenancy', link: '/guide/multi-tenancy' },
            { text: 'RBAC & permissions', link: '/guide/rbac' },
            { text: 'Provider drivers', link: '/guide/providers' },
          ],
        },
        {
          text: 'Operate',
          items: [
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Self-hosting', link: '/guide/self-hosting' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Public Project API', link: '/api/public' },
            { text: 'Client / Widget API', link: '/api/client' },
            { text: 'Dashboard API', link: '/api/dashboard' },
          ],
        },
      ],
      '/integrations/': [
        {
          text: 'Integrate',
          items: [
            { text: 'Server SDK', link: '/integrations/sdk' },
            { text: 'Widget', link: '/integrations/widget' },
            { text: 'Webhooks', link: '/integrations/webhooks' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: repo }],

    search: { provider: 'local' },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Built on Arkstack + Arkormˣ.',
    },
  },
})
