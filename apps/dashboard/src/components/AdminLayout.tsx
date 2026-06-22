import { useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, LogOut, Moon, ScrollText, Settings, ShieldCheck, Sun, Users } from 'lucide-react'
import type { AdminPermissionKey } from '@arkyc/types'
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
import { cn } from '@/lib/utils'

interface AdminNavItem {
  to: string
  label: string
  icon: typeof Settings
  perm: AdminPermissionKey
  end?: boolean
}

const NAV: AdminNavItem[] = [
  { to: 'settings', label: 'Settings', icon: Settings, perm: 'admin.settings.view', end: true },
  { to: 'tenants', label: 'Tenants', icon: Building2, perm: 'admin.tenants.view' },
  { to: 'users', label: 'Users', icon: Users, perm: 'admin.users.view' },
  { to: 'audit-logs', label: 'Audit log', icon: ScrollText, perm: 'admin.audit.view' },
]

/**
 * The platform-admin shell (above tenants). Gated by `useAdmin()`: non-admins are
 * redirected back to the tenant app; the server enforces every endpoint regardless.
 */
export function AdminLayout() {
  const { isAdmin, can, loading } = useAdmin()

  if (loading) return <Loading />
  if (!isAdmin) return <Navigate to="/" replace />

  const items = NAV.filter((item) => can(item.perm))

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2 px-6">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">Platform</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Administration
          </p>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
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
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AdminTopbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useState(isDark())

  const email = user?.email ?? ''
  const initial = (email[0] ?? 'U').toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-6 backdrop-blur">
      <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Button>

      <div className="flex items-center gap-1.5">
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
