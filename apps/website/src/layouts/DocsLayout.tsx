import { NavLink, Outlet } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Container } from '@/components/Container'
import { links } from '@/lib/site'
import { cn } from '@/lib/utils'

const DOC_NAV = [
  { label: 'Getting started', to: '/docs', end: true },
  { label: 'Hosted launcher', to: '/docs/widget', end: false },
  { label: 'Embed @arkyc/widget', to: '/docs/widget-embed', end: false },
  { label: 'Server SDK', to: '/docs/sdk', end: false },
  { label: 'Webhooks', to: '/docs/webhooks', end: false },
]

export function DocsLayout() {
  return (
    <div className="pt-16">
      <Container className="flex gap-12 py-12">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Integration</p>
            <nav className="mt-3 flex flex-col gap-0.5">
              {DOC_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <a
                href={links.ossDocs}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 text-sm font-medium text-slate-500 hover:text-ink"
              >
                Self-hosting docs <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </aside>

        <main className="min-w-0 max-w-2xl flex-1">
          <Outlet />
        </main>
      </Container>
    </div>
  )
}
