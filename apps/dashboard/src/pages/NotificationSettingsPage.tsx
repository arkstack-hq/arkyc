import { useState } from 'react'
import { useRequest } from 'alova/client'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@arkyc/types'
import { Notifications, Realtime, errorMessage } from '@/lib/api'
import { createRealtimeClient } from '@/lib/realtime/client'
import { AUTH_TOKEN_KEY } from '@/lib/requests/alova'
import { env } from '@/config/environment'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { Loading, PageHeader } from '@/components/States'

type DeviceStatus = 'enabled' | 'disabled' | 'denied' | 'unsupported' | null

const DEVICE_MESSAGES: Record<Exclude<DeviceStatus, null>, string> = {
  enabled: 'Push notifications are on for this browser.',
  disabled: 'Push notifications are off for this browser.',
  denied: 'Notifications are blocked for this site. Allow them in your browser settings, then try again.',
  unsupported: 'This browser cannot receive push notifications.',
}

/** Whether this browser has the APIs web push needs. */
const browserSupportsPush = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window

export default function NotificationSettingsPage() {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(null)

  const { data: preferences, loading } = useRequest(Notifications.preferences(), {
    initialData: DEFAULT_NOTIFICATION_PREFERENCES,
  })
  const { data: realtimeConfig } = useRequest(Realtime.config())

  const {
    send: save,
    loading: saving,
    error,
  } = useRequest((push: boolean) => Notifications.updatePreferences({ push }), { immediate: false })

  const {
    send: registerDevice,
    loading: registering,
    error: registerError,
  } = useRequest(
    (token: string) =>
      Notifications.registerDevice({ token, platform: 'web', device_name: navigator.userAgent.slice(0, 255) }),
    { immediate: false },
  )

  const {
    send: unregisterDevice,
    loading: unregistering,
    error: unregisterError,
  } = useRequest(() => Notifications.unregisterDevice(), { immediate: false })

  const pushAvailable = Boolean(realtimeConfig?.firebase)

  const enableDevice = async () => {
    if (!realtimeConfig || !browserSupportsPush()) {
      setDeviceStatus('unsupported')

      return
    }

    const client = createRealtimeClient(realtimeConfig, {
      apiBase: `${env('VITE_API_URL', '')}/api`,
      token: localStorage.getItem(AUTH_TOKEN_KEY),
    })
    const token = await client.deviceToken({ serviceWorker: '/push-sw.js' }).catch(() => null)

    if (!token) {
      setDeviceStatus(Notification.permission === 'denied' ? 'denied' : 'unsupported')

      return
    }

    await registerDevice(token)
    setDeviceStatus('enabled')
  }

  const disableDevice = async () => {
    await unregisterDevice()
    setDeviceStatus('disabled')
  }

  const deviceError = registerError ?? unregisterError

  return (
    <div className="mx-auto w-full max-w-2xl p-6 lg:p-8">
      <PageHeader title="Notifications" description="Choose how Arkyc reaches you." />

      {loading ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-6">
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

          {pushAvailable ? (
            <Card>
              <CardHeader>
                <CardTitle>This browser</CardTitle>
                <CardDescription>
                  Get notifications here even when the dashboard is closed. Signing out turns this off.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void enableDevice()} disabled={registering || !preferences.push}>
                    Enable on this browser
                  </Button>
                  <Button variant="outline" onClick={() => void disableDevice()} disabled={unregistering}>
                    Disable on this browser
                  </Button>
                </div>
                {!preferences.push ? (
                  <p className="text-sm text-muted-foreground">Turn on push notifications above to enable a device.</p>
                ) : null}
                {deviceStatus ? <p className="text-sm text-muted-foreground">{DEVICE_MESSAGES[deviceStatus]}</p> : null}
                {deviceError ? <FieldError>{errorMessage(deviceError)}</FieldError> : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}
