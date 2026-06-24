import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/atom-one-dark.css'
import { cn } from '@/lib/utils'

// Register only the languages the docs use — keeps the bundle small (the full
// highlight.js auto-bundle ships ~190 grammars).
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)

/** Languages we highlight. `xml` covers HTML (e.g. a `<script>` embed). */
export type CodeLang = 'typescript' | 'bash' | 'json' | 'xml'

/** A dark window-chrome code block with syntax highlighting — used in docs and feature visuals. */
export function CodeCard({
  title,
  code,
  lang = 'typescript',
  className,
}: {
  title?: string
  code: string
  lang?: CodeLang
  className?: string
}) {
  const highlighted = hljs.highlight(code, { language: lang }).value

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
        {/* The theme paints `.hljs` with its own background; keep the card's instead. */}
        <code className="hljs bg-transparent! font-mono" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}
