import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, Bell, KeyRound, MailOpen } from 'lucide-react'
import { RealtimeProvider } from '@/contexts/realtime-context'
import { NotificationBell } from '@/components/NotificationBell'
import { DocsLink, NavCount, ThemeToggle, UserMenu } from '@/components/Layout'
import { Invitations } from '@/lib/api/invitations'
import { useAttentionCount } from '@/hooks/useAttentionCount'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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

const NAV = [
  { to: '/account/security', label: 'Security', icon: KeyRound },
  { to: '/account/notifications', label: 'Notifications', icon: Bell },
  { to: '/invitations', label: 'Invitations', icon: MailOpen },
]

/** The app shell for the signed-in user's own pages, which belong to no organization. */
export function AccountLayout() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const current = NAV.find((item) => location.pathname.startsWith(item.to))
  const badges: Partial<Record<string, number>> = { '/invitations': useAttentionCount(() => Invitations.count()) }

  return (
    <RealtimeProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <SidebarMenuButton asChild size="lg" className="gap-2.5" tooltip="Back to dashboard">
              <Link to="/">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ArrowLeft className="size-4" />
                </span>
                <span className="truncate text-sm font-medium group-data-[state=collapsed]/sidebar:hidden">
                  Back to dashboard
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Account</SidebarGroupLabel>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={item === current} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span className="truncate group-data-[state=collapsed]/sidebar:hidden">{item.label}</span>
                        <NavCount count={badges[item.to] ?? 0} />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <DocsLink />
            <UserMenu />
          </SidebarFooter>
        </Sidebar>

        <SidebarInset onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 12)}>
          <div className="px-3 pb-3 pt-3">
            <main className="min-h-[calc(100svh-1.5rem)] rounded-xl border border-border bg-card">
              <SidebarHeaderBar scrolled={scrolled}>
                <SidebarTrigger />
                <div className="mx-1 h-5 w-px bg-border" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden sm:inline-flex">
                      <BreadcrumbPage className="text-muted-foreground">Account</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:inline-flex" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{current?.label ?? 'Account'}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="ml-auto flex items-center gap-2">
                  <NotificationBell />
                  <ThemeToggle />
                </div>
              </SidebarHeaderBar>
              <Outlet />
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RealtimeProvider>
  )
}
