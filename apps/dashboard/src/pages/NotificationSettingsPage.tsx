import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@arkyc/types'
import { Notifications, errorMessage } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { Loading, PageHeader } from '@/components/States'

export default function NotificationSettingsPage() {
  const { data: preferences, loading } = useRequest(Notifications.preferences(), {
    initialData: DEFAULT_NOTIFICATION_PREFERENCES,
  })

  const {
    send: save,
    loading: saving,
    error,
  } = useRequest((push: boolean) => Notifications.updatePreferences({ push }), { immediate: false })

  return (
    <div className="mx-auto w-full max-w-2xl p-6 lg:p-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>
      <PageHeader title="Notifications" description="Choose how Arkyc reaches you." />

      {loading ? (
        <Loading />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Push notifications</CardTitle>
            <CardDescription>
              Notifications always appear in the dashboard. Push sends them to the devices you have signed in on as
              well.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={preferences.push}
                disabled={saving}
                onChange={(e) => void save(e.target.checked)}
              />
              Send push notifications to my devices
            </label>
            {error ? <FieldError>{errorMessage(error)}</FieldError> : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
