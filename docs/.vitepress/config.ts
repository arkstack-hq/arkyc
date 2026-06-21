import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Arkyc',
  description:
    'Open-source, multi-tenant identity verification — document capture, OCR, liveness, face match, decisioning, reviews, webhooks, SDK and widget.',
  lastUpdated: true,
  cleanUrls: true,

  themeConfig: {
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

    // Add the repository link once published:
    // socialLinks: [{ icon: 'github', link: 'https://github.com/<org>/arkyc' }],

    search: { provider: 'local' },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Built on Arkstack + Arkormˣ.',
    },
  },
})
