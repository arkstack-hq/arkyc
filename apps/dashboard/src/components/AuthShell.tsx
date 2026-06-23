import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

import { Logo } from '@/components/Logo'

const HIGHLIGHTS = [
  'Identity verification that fits your brand',
  'Document, liveness and face-match checks',
  'Real-time decisions across your organizations',
]

/**
 * The shared two-panel shell for the auth screens (login, register, password
 * reset, email verification): a gold brand panel on desktop alongside a centered
 * form column that stacks to a clean single column on mobile.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-linear-to-br from-[#7a5c00] via-[#a9780a] to-[#3a2c05] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(60% 50% at 20% 0%, rgba(255,220,140,0.45), transparent), radial-gradient(50% 50% at 100% 100%, rgba(0,0,0,0.45), transparent)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <Logo className="size-9" />
          <span className="text-lg font-semibold tracking-tight text-white">Arkyc</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white">Verify identities with confidence.</h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-50/80">
            Onboard and verify your users with a flow you control — branded, secure, and decided in real time.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-amber-50/90">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <ShieldCheck className="size-3.5 text-amber-100" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-amber-50/50">© {new Date().getFullYear()} Arkyc</p>
      </aside>

      {/* Form panel */}
      <main className="flex w-full flex-col items-center justify-center bg-background p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Logo className="size-8" />
            <span className="text-lg font-semibold tracking-tight">Arkyc</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>

          {children}

          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}
