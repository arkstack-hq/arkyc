import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react'
import type { PermissionKey } from '@arkyc/types'
import { TenantProvider, useTenant } from '@/contexts/tenant-context'
import { RealtimeProvider } from '@/contexts/realtime-context'
import { useAdmin } from '@/contexts/admin-context'
import { useAuth } from '@/contexts/auth-context'
import { isDark, toggleTheme } from '@/lib/theme'
import { Loading } from '@/components/States'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  perm?: PermissionKey
  end?: boolean
  group: string
}

const NAV: NavItem[] = [
  { to: 'overview', label: 'Overview', icon: LayoutDashboard, end: true, group: 'Workspace' },
  { to: 'sessions', label: 'Sessions', icon: ScrollText, perm: 'sessions.view', group: 'Workspace' },
  { to: 'reviews', label: 'Reviews', icon: ClipboardCheck, perm: 'reviews.view', group: 'Workspace' },
  { to: 'projects', label: 'Projects', icon: Boxes, perm: 'projects.view', group: 'Workspace' },
  { to: 'members', label: 'Members', icon: Users, perm: 'members.view', group: 'Organization' },
  { to: 'audit-logs', label: 'Audit Logs', icon: ScrollText, perm: 'audit_logs.view', group: 'Organization' },
  { to: 'settings', label: 'Settings', icon: Settings, perm: 'settings.view', group: 'Organization' },
]

/** The nav items the current user may see, given a permission predicate. */
export function visibleNavItems(can: (perm: PermissionKey) => boolean): NavItem[] {
  return NAV.filter((item) => !item.perm || can(item.perm))
}

/** Visible nav items grouped by section, preserving order. */
function groupedNav(items: NavItem[]): Array<{ group: string; items: NavItem[] }> {
  const groups: Array<{ group: string; items: NavItem[] }> = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.group === item.group) last.items.push(item)
    else groups.push({ group: item.group, items: [item] })
  }
  return groups
}

export function TenantLayout() {
  return (
    <TenantProvider>
      <RealtimeProvider>
        <LayoutInner />
      </RealtimeProvider>
    </TenantProvider>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
  )

function LayoutInner() {
  const { tenant, loading, notFound, can } = useTenant()

  if (loading) return <Loading />
  if (notFound || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Tenant not found or you are not a member.{' '}
        <NavLink to="/" className="ml-1 text-primary underline">
          Go back
        </NavLink>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 px-6">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="text-base font-semibold tracking-tight">Arkyc</span>
        </div>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
          {groupedNav(visibleNavItems(can)).map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">{group}</p>
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Topbar() {
  const { tenant, tenants } = useTenant()
  const { user, logout } = useAuth()
  const { isAdmin } = useAdmin()
  const navigate = useNavigate()
  const [dark, setDark] = useState(isDark())

  const email = user?.email ?? ''
  const initial = (email[0] ?? 'U').toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
      <Select
        className="w-56"
        value={tenant?.slug ?? ''}
        onChange={(e) => navigate(`/t/${e.target.value}/overview`)}
        aria-label="Switch tenant"
      >
        {tenants.map((tn) => (
          <option key={tn.id} value={tn.slug}>
            {tn.name}
          </option>
        ))}
      </Select>

      <div className="flex items-center gap-1.5">
        {isAdmin ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            aria-label="Platform admin"
            onClick={() => navigate('/admin')}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Admin</span>
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setDark(toggleTheme())}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              <Avatar>
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="truncate normal-case text-foreground">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void logout().then(() => navigate('/login'))}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
