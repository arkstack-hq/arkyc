import { cn } from '@/lib/utils'

export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <img src="/arkyc-logo.png" alt="" aria-hidden="true" className="size-7" />
      <span className={cn('text-[17px]', dark ? 'text-white' : 'text-ink')}>Arkyc</span>
    </span>
  )
}
