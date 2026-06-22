import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react'
import type { PermissionKey } from '@arkyc/types'
import { TenantProvider, useTenant } from '@/contexts/tenant-context'
import { useAdmin } from '@/contexts/admin-context'
import { useAuth } from '@/contexts/auth-context'
import { isDark, toggleTheme } from '@/lib/theme'
import { Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  perm?: PermissionKey
  end?: boolean
}

const NAV: NavItem[] = [
  { to: 'overview', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: 'sessions', label: 'Sessions', icon: ScrollText, perm: 'sessions.view' },
  { to: 'reviews', label: 'Reviews', icon: ClipboardCheck, perm: 'reviews.view' },
  { to: 'projects', label: 'Projects', icon: Boxes, perm: 'projects.view' },
  { to: 'members', label: 'Members', icon: Users, perm: 'members.view' },
  { to: 'audit-logs', label: 'Audit Logs', icon: ScrollText, perm: 'audit_logs.view' },
  { to: 'settings', label: 'Settings', icon: Settings, perm: 'settings.view' },
]

/** The nav items the current user may see, given a permission predicate. */
export function visibleNavItems(can: (perm: PermissionKey) => boolean): NavItem[] {
  return NAV.filter((item) => !item.perm || can(item.perm))
}

export function TenantLayout() {
  return (
    <TenantProvider>
      <LayoutInner />
    </TenantProvider>
  )
}

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
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center px-5 text-lg font-semibold tracking-tight">
          Arkyc
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleNavItems(can).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-6">
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

      <div className="flex items-center gap-2">
        {isAdmin ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            aria-label="Platform admin"
            onClick={() => navigate('/admin')}
          >
            <ShieldCheck className="h-4 w-4" />
            Admin
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setDark(toggleTheme())}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void logout().then(() => navigate('/login'))}
        >
          Sign out
        </Button>
      </div>
    </header>
  )
}
