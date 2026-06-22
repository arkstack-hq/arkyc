import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 [&_svg]:size-4'

const sizes = {
  md: 'h-10 px-4',
  lg: 'h-12 px-6 text-[15px]',
}

const variants = {
  brand: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow-md hover:-translate-y-0.5',
  light: 'bg-white text-ink hover:bg-slate-100 shadow-sm hover:-translate-y-0.5',
  outline: 'border border-slate-300 bg-white text-ink hover:border-brand-400 hover:text-brand-700',
  ghost: 'text-slate-700 hover:bg-slate-100',
  ghostLight: 'text-white/80 hover:text-white hover:bg-white/10',
}

type Variant = keyof typeof variants
type Size = keyof typeof sizes

function classesFor(variant: Variant, size: Size, className?: string) {
  return cn(base, sizes[size], variants[variant], className)
}

/** An external/anchor button (default for marketing CTAs that leave to the app). */
export function ButtonLink({
  variant = 'brand',
  size = 'md',
  className,
  ...props
}: ComponentProps<'a'> & { variant?: Variant; size?: Size }) {
  return <a className={classesFor(variant, size, className)} {...props} />
}

/** A router-internal button (e.g. to /docs). */
export function ButtonRoute({
  to,
  variant = 'brand',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link to={to} className={classesFor(variant, size, className)} {...props} />
}
