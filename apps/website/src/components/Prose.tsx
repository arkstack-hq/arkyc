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
        '[&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-ink [&_h3]:scroll-mt-24',
        '[&_p]:mt-4',
        '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5',
        '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_a]:font-medium [&_a]:text-brand-600 [&_a:hover]:underline',
        '[&_strong]:font-semibold [&_strong]:text-ink',
        // Tables: option/event/method references in the docs.
        '[&_table]:mt-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-[13.5px]',
        '[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-slate-200 [&_th]:py-2 [&_th]:pr-5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-ink',
        '[&_td]:border-b [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-5 [&_td]:align-top',
        '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-slate-100 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[13px] [&_:not(pre)>code]:text-brand-700',
        className,
      )}
    >
      {children}
    </div>
  )
}
