import { AnimatePresence, motion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { links, primaryNav } from '@/lib/site'
import { useEffect, useState } from 'react'

import { ButtonLink } from '@/components/Button'
import { Container } from '@/components/Container'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const hasBanner = ['/'].includes(pathname)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Before scroll the bar is transparent over the dark hero, so links/logo need
  // light text; once scrolled the bar is white, so they switch to dark.
  const navLinkClass = cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    scrolled || !hasBanner ? 'text-slate-600 hover:text-ink' : 'text-white/80 hover:text-white',
  )

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled ? 'border-b border-slate-200/80 bg-white/80 backdrop-blur-md' : 'border-b border-transparent',
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" aria-label="Arkyc home">
          <Logo dark={!scrolled} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {primaryNav.map((item) =>
            item.href.startsWith('/#') ? (
              <a key={item.label} href={item.href} className={navLinkClass}>
                {item.label}
              </a>
            ) : (
              <Link key={item.label} to={item.href} className={navLinkClass}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href={links.login} variant={scrolled ? 'ghost' : 'ghostLight'}>
            Log in
          </ButtonLink>
          <ButtonLink href={links.signup} variant="brand">
            Start free
          </ButtonLink>
        </div>

        <button
          className={cn(
            'inline-flex size-10 items-center justify-center rounded-md md:hidden',
            scrolled ? 'text-ink' : 'text-white',
          )}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </Container>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200 bg-white md:hidden"
          >
            <Container className="flex flex-col gap-1 py-4">
              {primaryNav.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 flex gap-2">
                <ButtonLink href={links.login} variant="outline" className="flex-1">
                  Log in
                </ButtonLink>
                <ButtonLink href={links.signup} variant="brand" className="flex-1">
                  Start free
                </ButtonLink>
              </div>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
