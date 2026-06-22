import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { PanelLeft } from 'lucide-react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A pragmatic port of the shadcn `sidebar` block: a collapsible (icon-rail)
 * desktop sidebar plus an off-canvas drawer on mobile, with a context that the
 * header trigger and menu buttons read. Open state persists to localStorage.
 */

const STORAGE_KEY = 'sidebar:state'
const MOBILE_BREAKPOINT = 768

type SidebarState = 'expanded' | 'collapsed'

interface SidebarContextValue {
  state: SidebarState
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider')
  return ctx
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

export function SidebarProvider({ children, className, style, ...props }: ComponentProps<'div'>) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = useState(false)
  const [open, setOpenState] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(STORAGE_KEY) !== 'collapsed'
  })

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, value ? 'expanded' : 'collapsed')
  }, [])

  const toggleSidebar = useCallback(() => {
    if (isMobile) setOpenMobile((v) => !v)
    else setOpen(!open)
  }, [isMobile, open, setOpen])

  // Close the drawer on navigation away from mobile.
  useEffect(() => {
    if (!isMobile) setOpenMobile(false)
  }, [isMobile])

  // ⌘/Ctrl-B toggles, matching the kit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

  const value = useMemo<SidebarContextValue>(
    () => ({
      state: open ? 'expanded' : 'collapsed',
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
    }),
    [open, setOpen, openMobile, isMobile, toggleSidebar],
  )

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider delayDuration={0}>
        <div
          className={cn('group/sidebar-wrapper flex min-h-screen w-full bg-background', className)}
          style={{ '--sidebar-width': '16rem', '--sidebar-width-icon': '3.25rem', ...style } as CSSProperties}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

export function Sidebar({ className, children, ...props }: ComponentProps<'div'>) {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar()

  if (isMobile) {
    return (
      <>
        {openMobile ? (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setOpenMobile(false)}
            role="presentation"
          />
        ) : null}
        <div
          data-state={openMobile ? 'open' : 'closed'}
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex h-full w-[18rem] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 md:hidden',
            openMobile ? 'translate-x-0' : '-translate-x-full',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </>
    )
  }

  return (
    <div
      data-state={state}
      className={cn(
        'group/sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out md:flex',
        state === 'expanded' ? 'w-(--sidebar-width)' : 'w-(--sidebar-width-icon)',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 p-2', className)} {...props} />
}

export function SidebarContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2', className)}
      {...props}
    />
  )
}

export function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 p-2', className)} {...props} />
}

export function SidebarGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 py-1', className)} {...props} />
}

export function SidebarGroupLabel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex h-7 items-center px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70 transition-opacity duration-200',
        'group-data-[state=collapsed]/sidebar:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

export function SidebarMenu({ className, ...props }: ComponentProps<'ul'>) {
  return <ul className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<'li'>) {
  return <li className={cn('group/menu-item relative', className)} {...props} />
}

const sidebarMenuButtonVariants = cva(
  cn(
    'peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-md px-3 py-2 text-left text-sm font-medium outline-none transition-colors',
    'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0',
    'group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0',
  ),
  {
    variants: {
      size: {
        default: 'h-9',
        lg: 'h-12 group-data-[state=collapsed]/sidebar:!p-0',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

export function SidebarMenuButton({
  className,
  isActive = false,
  asChild = false,
  tooltip,
  size,
  children,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    isActive?: boolean
    asChild?: boolean
    tooltip?: string
  }) {
  const { state, isMobile } = useSidebar()
  const Comp = asChild ? Slot.Root : 'button'

  const button = (
    <Comp
      data-active={isActive}
      className={cn(
        sidebarMenuButtonVariants({ size }),
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  )

  if (!tooltip || state !== 'collapsed' || isMobile) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function SidebarTrigger({ className, ...props }: ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      aria-label="Toggle sidebar"
      onClick={toggleSidebar}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <PanelLeft className="size-4" />
    </button>
  )
}

export function SidebarInset({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex min-h-screen min-w-0 flex-1 flex-col', className)} {...props} />
}

export function SidebarSeparator({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-2 h-px bg-sidebar-border', className)} {...props} />
}

/** Convenience wrapper used by the header to host a breadcrumb beside the trigger. */
export function SidebarHeaderBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur',
        className,
      )}
    >
      {children}
    </header>
  )
}
