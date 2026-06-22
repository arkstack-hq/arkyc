import { useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Boxes,
  ChevronsUpDown,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { CommandMenu, CommandMenuTrigger, type CommandGroup } from '@/components/ui/command-menu'
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

/** The path segment after `/t/:slug/`, used to mark the active nav item. */
function activeSegment(pathname: string): string {
  return pathname.split('/').slice(3).join('/')
}

function isActiveItem(seg: string, item: NavItem): boolean {
  if (item.end) return seg === item.to || seg === ''
  return seg === item.to || seg.startsWith(`${item.to}/`)
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

function LayoutInner() {
  const { tenant, loading, notFound, can } = useTenant()

  if (loading) return <Loading />
  if (notFound || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Tenant not found or you are not a member.{' '}
        <Link to="/" className="ml-1 text-primary underline">
          Go back
        </Link>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <TenantSidebar can={can} />
      <SidebarInset>
        <TenantHeader can={can} />
        <div className="px-3 pb-3 pt-3">
          <main className="min-h-[calc(100svh-5.5rem)] rounded-xl border border-border bg-card">
            <Outlet />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function TenantSidebar({ can }: { can: (perm: PermissionKey) => boolean }) {
  const { tenant, tenants } = useTenant()
  const navigate = useNavigate()
  const location = useLocation()
  const seg = activeSegment(location.pathname)

  return (
    <Sidebar>
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="gap-2.5 focus-visible:ring-0 data-[state=open]:bg-sidebar-accent">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                {(tenant?.name?.[0] ?? 'A').toUpperCase()}
              </span>
              <span className="flex flex-1 flex-col text-left leading-tight group-data-[state=collapsed]/sidebar:hidden">
                <span className="truncate text-sm font-semibold text-foreground">{tenant?.name ?? 'Arkyc'}</span>
                <span className="truncate text-xs text-muted-foreground">Organization</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[state=collapsed]/sidebar:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            {tenants.map((tn) => (
              <DropdownMenuItem key={tn.id} onSelect={() => navigate(`/t/${tn.slug}/overview`)}>
                <span className="flex size-5 items-center justify-center rounded bg-muted text-[10px] font-bold">
                  {tn.name[0]?.toUpperCase()}
                </span>
                <span className="truncate">{tn.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/onboarding')}>
              <Plus className="size-4" />
              Create organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        {groupedNav(visibleNavItems(can)).map(({ group, items }) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActiveItem(seg, item)} tooltip={item.label}>
                    <Link to={item.to}>
                      <item.icon />
                      <span className="truncate group-data-[state=collapsed]/sidebar:hidden">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const { isAdmin } = useAdmin()
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
        {isAdmin ? (
          <DropdownMenuItem onSelect={() => navigate('/admin')}>
            <ShieldCheck className="size-4" />
            Platform admin
          </DropdownMenuItem>
        ) : null}
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

function TenantHeader({ can }: { can: (perm: PermissionKey) => boolean }) {
  const { tenant } = useTenant()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [dark, setDark] = useState(isDark())

  const seg = activeSegment(location.pathname)
  const current = visibleNavItems(can).find((item) => isActiveItem(seg, item))

  const groups: CommandGroup[] = useMemo(() => {
    const out: CommandGroup[] = [
      {
        heading: 'Navigation',
        items: visibleNavItems(can).map((item) => ({
          label: item.label,
          icon: item.icon,
          onSelect: () => navigate(`/t/${tenant?.slug}/${item.to}`),
        })),
      },
      {
        heading: 'Account',
        items: [{ label: 'Sign out', icon: LogOut, onSelect: () => void logout().then(() => navigate('/login')) }],
      },
    ]
    return out
  }, [can, navigate, tenant?.slug, logout])

  return (
    <SidebarHeaderBar>
      <SidebarTrigger />
      <div className="mx-1 h-5 w-px bg-border" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbPage className="text-muted-foreground">{tenant?.name}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:inline-flex" />
          <BreadcrumbItem>
            <BreadcrumbPage>{current?.label ?? 'Overview'}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <CommandMenuTrigger onClick={() => setCmdOpen(true)} />
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() => setDark(toggleTheme())}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} groups={groups} />
    </SidebarHeaderBar>
  )
}
