import { cn } from '@/lib/utils'

export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
        A
      </span>
      <span className={cn('text-[17px]', dark ? 'text-white' : 'text-ink')}>Arkyc</span>
    </span>
  )
}
