import { Reveal } from '@/components/Reveal'
import { cn } from '@/lib/utils'

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = true,
  dark = false,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  center?: boolean
  dark?: boolean
}) {
  return (
    <Reveal className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      {eyebrow ? (
        <p className={cn('text-sm font-semibold', dark ? 'text-brand-300' : 'text-brand-600')}>{eyebrow}</p>
      ) : null}
      <h2 className={cn('mt-2 text-3xl font-bold tracking-tight sm:text-4xl', dark ? 'text-white' : 'text-ink')}>
        {title}
      </h2>
      {subtitle ? (
        <p className={cn('mt-4 text-lg leading-relaxed', dark ? 'text-white/70' : 'text-slate-600')}>{subtitle}</p>
      ) : null}
    </Reveal>
  )
}
