import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Lightweight prose styling for docs (no typography plugin needed). */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-[15px] leading-relaxed text-slate-700',
        '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-ink',
        '[&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink',
        '[&_h2]:scroll-mt-24',
        '[&_p]:mt-4',
        '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5',
        '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_a]:font-medium [&_a]:text-brand-600 [&_a:hover]:underline',
        '[&_strong]:font-semibold [&_strong]:text-ink',
        '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-slate-100 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[13px] [&_:not(pre)>code]:text-brand-700',
        className,
      )}
    >
      {children}
    </div>
  )
}
