import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePagination, useRequest } from 'alova/client'
import type { UserNotification } from '@arkyc/types'
import { Notifications } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { useRealtime, useRealtimeChannel } from '@/contexts/realtime-context'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatDateTime } from '@/lib/utils'

/**
 * Header bell: the unread count, the latest notifications, and live updates on
 * the user's private channel.
 */
export function NotificationBell() {
  const { user } = useAuth()
  const realtime = useRealtime()
  const navigate = useNavigate()

  const { data: unread, send: refreshUnread } = useRequest(Notifications.unreadCount(), { initialData: 0 })

  const {
    data: notifications,
    page,
    isLastPage,
    loading,
    update,
    reload,
  } = usePagination((currentPage, pageSize) => Notifications.list({ page: currentPage, limit: pageSize }), {
    append: true,
    initialPage: 1,
    initialPageSize: 10,
    data: (res) => res.data,
    total: (res) => res.meta.total,
  })

  const { send: markRead } = useRequest((id: string) => Notifications.markRead(id), { immediate: false })
  const { send: markAllRead, loading: markingAll } = useRequest(() => Notifications.markAllRead(), {
    immediate: false,
  })

  useRealtimeChannel(
    user && realtime ? realtime.channelFor(user.id) : null,
    () => {
      void reload()
      void refreshUnread()
    },
    ['notification'],
  )

  const open = async (notification: UserNotification) => {
    if (!notification.read_at) await markRead(notification.id)
    if (notification.action_link) navigate(notification.action_link)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
          className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="size-4" />
          {unread ? (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm normal-case text-foreground">Notifications</DropdownMenuLabel>
          <button
            type="button"
            disabled={!unread || markingAll}
            onClick={() => void markAllRead()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <CheckCheck className="size-3.5" />
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && !loading ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : null}

          {notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onSelect={() => void open(notification)}
              className="flex flex-col items-start gap-0.5 rounded-none px-3 py-2.5"
            >
              <span className="flex w-full items-center gap-2">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    notification.read_at ? 'bg-transparent' : 'bg-primary',
                  )}
                />
                <span className={cn('truncate text-sm', !notification.read_at && 'font-medium')}>
                  {notification.title}
                </span>
              </span>
              <span className="line-clamp-2 pl-3.5 text-xs text-muted-foreground">{notification.description}</span>
              <span className="pl-3.5 text-[11px] text-muted-foreground">
                {formatDateTime(notification.created_at)}
              </span>
            </DropdownMenuItem>
          ))}

          {loading ? (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          ) : !isLastPage && notifications.length ? (
            <button
              type="button"
              onClick={() => update({ page: page + 1 })}
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Load more
            </button>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
