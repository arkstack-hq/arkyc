import { Link } from 'react-router-dom'
import { Container } from '@/components/Container'
import { Logo } from '@/components/Logo'
import { links } from '@/lib/site'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.33-1.73-1.33-1.73-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.8 1.28 3.49.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 6 0c2.29-1.53 3.3-1.21 3.3-1.21.66 1.65.25 2.87.12 3.17.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.83.56A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  )
}

const columns = [
  {
    title: 'Product',
    items: [
      { label: 'How it works', href: '/#how' },
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Developers',
    items: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Embed the widget', href: '/docs/widget' },
      { label: 'Webhooks', href: '/docs/webhooks' },
    ],
  },
  {
    title: 'Open source',
    items: [
      { label: 'Project docs', href: links.ossDocs, external: true },
      { label: 'GitHub', href: links.github, external: true },
      { label: 'Self-host', href: links.ossDocs, external: true },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-slate-500">
            Hosted identity verification with an open-source core. Verify your users without building the pipeline.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href={links.github}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="text-slate-400 transition-colors hover:text-ink"
            >
              <GithubIcon className="size-5" />
            </a>
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-ink">{col.title}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {col.items.map((item) => (
                <li key={item.label}>
                  {'external' in item && item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-slate-500 transition-colors hover:text-ink"
                    >
                      {item.label}
                    </a>
                  ) : item.href.startsWith('/#') ? (
                    <a href={item.href} className="text-sm text-slate-500 transition-colors hover:text-ink">
                      {item.label}
                    </a>
                  ) : (
                    <Link to={item.href} className="text-sm text-slate-500 transition-colors hover:text-ink">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-slate-200">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Arkyc. Open-source core, MIT licensed.</p>
          <p>Built on Arkstack + Arkormˣ.</p>
        </Container>
      </div>
    </footer>
  )
}
