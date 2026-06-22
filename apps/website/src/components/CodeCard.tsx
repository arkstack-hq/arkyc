import { cn } from '@/lib/utils'

/** A dark window-chrome code block — used in feature visuals and docs. */
export function CodeCard({ title, code, className }: { title?: string; code: string; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl shadow-brand-950/10',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="size-3 rounded-full bg-slate-700" />
        <span className="size-3 rounded-full bg-slate-700" />
        <span className="size-3 rounded-full bg-slate-700" />
        {title ? <span className="ml-2 text-xs text-slate-400">{title}</span> : null}
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}
