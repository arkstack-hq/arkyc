import { useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Building2, Moon, ScrollText, Settings, ShieldCheck, Sun, Users } from 'lucide-react'
import type { AdminPermissionKey } from '@arkyc/types'
import { useAdmin } from '@/contexts/admin-context'
import { useAuth } from '@/contexts/auth-context'
import { isDark, toggleTheme } from '@/lib/theme'
import { Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
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
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 px-5 text-lg font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Platform
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {items.map((item) => (
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
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-6">
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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-6">
      <Button variant="outline" size="sm" onClick={() => navigate('/')}>
        ← Back to dashboard
      </Button>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setDark(toggleTheme())}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
        <Button variant="outline" size="sm" onClick={() => void logout().then(() => navigate('/login'))}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
