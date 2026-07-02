import { useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react'
import type { AdminPermissionKey } from '@arkyc/types'
import { useRequest } from 'alova/client'
import { ExtendedAccess } from '@/lib/api'
import { useAdmin } from '@/contexts/admin-context'
import { useAuth } from '@/contexts/auth-context'
import { isDark, toggleTheme } from '@/lib/theme'
import { Loading } from '@/components/States'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarHeaderBar,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

interface AdminNavItem {
  to: string
  label: string
  icon: typeof Settings
  perm: AdminPermissionKey
  end?: boolean
}

const NAV: AdminNavItem[] = [
  { to: 'overview', label: 'Overview', icon: LayoutDashboard, perm: 'admin.organizations.view', end: true },
  { to: 'settings', label: 'Settings', icon: Settings, perm: 'admin.settings.view' },
  { to: 'organizations', label: 'Organizations', icon: Building2, perm: 'admin.organizations.view' },
  { to: 'extended-access', label: 'Extended access', icon: Sparkles, perm: 'admin.extended_access.view' },
  { to: 'users', label: 'Users', icon: Users, perm: 'admin.users.view' },
  { to: 'audit-logs', label: 'Audit log', icon: ScrollText, perm: 'admin.audit.view' },
]

function activeSegment(pathname: string): string {
  // Path after `/admin/`.
  return pathname.split('/').slice(2).join('/')
}

function isActiveItem(seg: string, item: AdminNavItem): boolean {
  if (item.end) return seg === item.to || seg === ''
  return seg === item.to || seg.startsWith(`${item.to}/`)
}

/**
 * The platform-admin shell (above organizations). Gated by `useAdmin()`: non-admins are
 * redirected back to the organization app; the server enforces every endpoint regardless.
 */
export function AdminLayout() {
  const { isAdmin, can, loading } = useAdmin()
  const [scrolled, setScrolled] = useState(false)

  // Badge the extended-access nav with the count of pending requests.
  const { data: pendingAccess } = useRequest(ExtendedAccess.pendingCount(), {
    immediate: can('admin.extended_access.view'),
    initialData: 0,
  })

  if (loading) return <Loading />
  if (!isAdmin) return <Navigate to="/" replace />

  const items = NAV.filter((item) => can(item.perm))
  const badges: Partial<Record<string, number>> = { 'extended-access': pendingAccess }

  return (
    <SidebarProvider>
      <AdminSidebar items={items} badges={badges} />
      <SidebarInset onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 12)}>
        <div className="px-3 pb-3 pt-3">
          <main className="min-h-[calc(100svh-1.5rem)] rounded-xl border border-border bg-card">
            <AdminHeader items={items} scrolled={scrolled} />
            <div className="p-6 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AdminSidebar({ items, badges }: { items: AdminNavItem[]; badges?: Partial<Record<string, number>> }) {
  const location = useLocation()
  const seg = activeSegment(location.pathname)

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span className="flex flex-1 flex-col leading-tight group-data-[state=collapsed]/sidebar:hidden">
            <span className="text-sm font-semibold text-foreground">Platform</span>
            <span className="text-xs text-muted-foreground">Administration</span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarMenu>
            {items.map((item) => {
              const count = badges?.[item.to] ?? 0
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActiveItem(seg, item)} tooltip={item.label}>
                    <Link to={item.to}>
                      <item.icon />
                      <span className="truncate group-data-[state=collapsed]/sidebar:hidden">{item.label}</span>
                      {count > 0 ? (
                        <Badge variant="warning" className="ml-auto group-data-[state=collapsed]/sidebar:hidden">
                          {count}
                        </Badge>
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenuButton asChild tooltip="Back to dashboard">
          <Link to="/">
            <ArrowLeft />
            <span className="truncate group-data-[state=collapsed]/sidebar:hidden">Back to dashboard</span>
          </Link>
        </SidebarMenuButton>
        <AdminUserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}

function AdminUserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dark, setDark] = useState(isDark())

  const email = user?.email ?? ''
  const name = user?.name || email || 'Account'
  const initial = (name[0] ?? 'U').toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="gap-2.5 focus-visible:ring-0 data-[state=open]:bg-sidebar-accent">
          <Avatar className="size-8">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <span className="flex flex-1 flex-col text-left leading-tight group-data-[state=collapsed]/sidebar:hidden">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
          </span>
          <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[state=collapsed]/sidebar:hidden" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="truncate normal-case text-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setDark(toggleTheme())
          }}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {dark ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout().then(() => navigate('/login'))}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AdminHeader({ items, scrolled }: { items: AdminNavItem[]; scrolled: boolean }) {
  const location = useLocation()
  const [dark, setDark] = useState(isDark())
  const seg = activeSegment(location.pathname)
  const current = items.find((item) => isActiveItem(seg, item))

  return (
    <SidebarHeaderBar scrolled={scrolled}>
      <SidebarTrigger />
      <div className="mx-1 h-5 w-px bg-border" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbPage className="text-muted-foreground">Platform</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:inline-flex" />
          <BreadcrumbItem>
            <BreadcrumbPage>{current?.label ?? 'Overview'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() => setDark(toggleTheme())}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
    </SidebarHeaderBar>
  )
}
