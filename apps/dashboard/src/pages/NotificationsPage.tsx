import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePagination, useRequest } from 'alova/client'
import { CheckCheck, Settings, Trash2 } from 'lucide-react'
import type { UserNotification } from '@arkyc/types'
import { Notifications } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { useRealtime, useRealtimeChannel } from '@/contexts/realtime-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { EmptyState, ErrorState, Loading, PageHeader } from '@/components/States'
import { Pagination } from '@/components/Pagination'
import { cn, formatDateTime } from '@/lib/utils'

type Filter = 'all' | 'unread'

/** The signed-in user's notification inbox. */
export default function NotificationsPage() {
  const { user } = useAuth()
  const realtime = useRealtime()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')

  const {
    data: notifications,
    page,
    pageCount,
    loading,
    error,
    update,
    reload,
  } = usePagination(
    (currentPage, pageSize) => Notifications.list({ page: currentPage, limit: pageSize, unread: filter === 'unread' }),
    {
      watchingStates: [filter],
      append: false,
      initialPage: 1,
      initialPageSize: 20,
      data: (res) => res.data,
      total: (res) => res.meta.total,
    },
  )

  const { data: unread, send: refreshUnread } = useRequest(Notifications.unreadCount(), { initialData: 0 })
  const { send: markRead } = useRequest((id: string) => Notifications.markRead(id), { immediate: false })
  const { send: remove } = useRequest((id: string) => Notifications.remove(id), { immediate: false })
  const { send: markAllRead, loading: markingAll } = useRequest(() => Notifications.markAllRead(), {
    immediate: false,
  })

  const refresh = () => {
    void reload()
    void refreshUnread()
  }

  useRealtimeChannel(user && realtime ? realtime.channelFor(user.id) : null, refresh, ['notification'])

  const open = async (notification: UserNotification) => {
    if (!notification.read_at) await markRead(notification.id)

    if (notification.action_link) navigate(notification.action_link)
    else refresh()
  }

  const act = async (action: Promise<unknown>) => {
    await action
    refresh()
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6 lg:p-8">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!unread || markingAll}
              onClick={() => void act(markAllRead())}
            >
              <CheckCheck />
              Mark all read
            </Button>
            <Button variant="ghost" size="icon-sm" asChild aria-label="Notification settings">
              <Link to="/account/notifications">
                <Settings />
              </Link>
            </Button>
          </>
        }
      />

      <SegmentedControl
        label="Filter notifications"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
        ]}
        className="mb-4"
      />

      {loading && notifications.length === 0 ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description="Reviews, sessions and organization updates will show up here."
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul className="divide-y divide-border">
            {notifications.map((notification) => (
              <li key={notification.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-accent/40">
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    notification.read_at ? 'bg-transparent' : 'bg-primary',
                  )}
                />
                <button
                  type="button"
                  onClick={() => void open(notification)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                >
                  <span className={cn('text-sm', !notification.read_at && 'font-medium')}>{notification.title}</span>
                  <span className="text-sm text-muted-foreground">{notification.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(notification.created_at)}
                    {notification.action_link ? ` · ${notification.action_text ?? 'Open'}` : ''}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {!notification.read_at ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Mark as read"
                      title="Mark as read"
                      onClick={() => void act(markRead(notification.id))}
                    >
                      <CheckCheck />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete notification"
                    title="Delete"
                    onClick={() => void act(remove(notification.id))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPage={(p) => update({ page: p })}
            loading={loading}
            className="border-t border-border px-4"
          />
        </Card>
      )}
    </div>
  )
}
