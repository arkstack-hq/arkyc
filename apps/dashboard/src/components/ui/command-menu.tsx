import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CommandItem {
  label: string
  icon?: ComponentType<{ className?: string }>
  hint?: string
  keywords?: string
  onSelect: () => void
}

export interface CommandGroup {
  heading: string
  items: CommandItem[]
}

/**
 * A lightweight command palette (⌘K): filterable, keyboard-navigable, built on
 * the house dialog style rather than pulling in cmdk. Controlled open state so a
 * header search button and the global shortcut can both drive it.
 */
export function CommandMenu({
  open,
  onOpenChange,
  groups,
  placeholder = 'Search for a command…',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: CommandGroup[]
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  // Global ⌘K / Ctrl-K to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) => !q || it.label.toLowerCase().includes(q) || (it.keywords ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, query])

  // Flatten for index-based keyboard selection.
  const flat = useMemo(() => filtered.flatMap((g) => g.items), [filtered])

  if (!open) return null

  const run = (item: CommandItem) => {
    onOpenChange(false)
    item.onSelect()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[active]
      if (item) run(item)
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  let runningIndex = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Command search"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          ) : (
            filtered.map((group) => (
              <div key={group.heading} className="mb-1">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group.heading}</p>
                {group.items.map((item) => {
                  runningIndex += 1
                  const idx = runningIndex
                  const Icon = item.icon
                  return (
                    <button
                      key={group.heading + item.label}
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => run(item)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                        idx === active ? 'bg-accent text-accent-foreground' : 'text-foreground',
                      )}
                    >
                      {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** The header trigger that looks like the kit's "Search… ⌘K" field. */
export function CommandMenuTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 sm:w-72 lg:w-96',
        className,
      )}
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
    </button>
  )
}
