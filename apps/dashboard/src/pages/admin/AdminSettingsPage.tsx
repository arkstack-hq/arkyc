import { Admin, errorMessage } from '@/lib/api'
import type { CaptureModel, GlobalSettings, RealtimeTransport } from '@arkyc/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { useForm, useRequest } from 'alova/client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useState } from 'react'

const TRANSPORTS: RealtimeTransport[] = ['off', 'polling', 'pusher', 'firebase']
const CAPTURE_MODELS: CaptureModel[] = ['passive', 'active', 'both']

export default function AdminSettingsPage() {
  const { data, error } = useRequest(Admin.settings())

  if (error) return <ErrorState error={error} />
  if (!data) return <Loading />

  return <SettingsForm settings={data} />
}

function SettingsForm({ settings }: { settings: GlobalSettings }) {
  const [saved, setSaved] = useState(false)

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData) =>
      Admin.updateSettings({
        platform: {
          name: formData.name,
          support_email: formData.supportEmail.trim() || null,
          signups_enabled: formData.signupsEnabled,
        },
        realtime: { transport: formData.transport },
        capture: { model: formData.captureModel },
      }),
    {
      initialForm: {
        name: settings.platform.name,
        supportEmail: settings.platform.support_email ?? '',
        signupsEnabled: settings.platform.signups_enabled,
        transport: settings.realtime.transport,
        captureModel: settings.capture.model,
      },
    },
  )

  onSuccess(() => setSaved(true))

  const dirtyReset = () => setSaved(false)

  return (
    <div>
      <PageHeader title="Platform settings" description="Settings that apply across all organizations." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>How the platform presents itself.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="platform-name">Name</FieldLabel>
              <Input
                id="platform-name"
                value={form.name}
                onChange={(e) => {
                  updateForm({ name: e.target.value })
                  dirtyReset()
                  if (error?.errors) error.delete('platform.name', update)
                }}
              />
              <FieldError errors={error?.list?.['platform.name']} />
            </Field>

            <Field>
              <FieldLabel htmlFor="platform-support-email">Support email</FieldLabel>
              <Input
                id="platform-support-email"
                type="email"
                placeholder="support@example.com"
                value={form.supportEmail}
                onChange={(e) => {
                  updateForm({ supportEmail: e.target.value })
                  dirtyReset()
                  if (error?.errors) error.delete('platform.support_email', update)
                }}
              />
              <FieldError errors={error?.list?.['platform.support_email']} />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.signupsEnabled}
                onChange={(e) => {
                  updateForm({ signupsEnabled: e.target.checked })
                  dirtyReset()
                }}
              />
              Allow new organization sign-ups
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Realtime</CardTitle>
            <CardDescription>Transport for verification events.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="realtime-transport">Transport</FieldLabel>
              <Select
                id="realtime-transport"
                value={form.transport}
                onChange={(e) => {
                  updateForm({ transport: e.target.value as RealtimeTransport })
                  dirtyReset()
                }}
              >
                {TRANSPORTS.map((transport) => (
                  <option key={transport} value={transport}>
                    {transport}
                  </option>
                ))}
              </Select>
              <FieldError errors={error?.list?.['realtime.transport']} />
            </Field>

            <Field>
              <FieldLabel htmlFor="capture-model">Capture model</FieldLabel>
              <Select
                id="capture-model"
                value={form.captureModel}
                onChange={(e) => {
                  updateForm({ captureModel: e.target.value as CaptureModel })
                  dirtyReset()
                }}
              >
                {CAPTURE_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
              <FieldError errors={error?.list?.['capture.model']} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {error && !error.errors ? <FieldError>{errorMessage(error, 'Failed to save.')}</FieldError> : null}
        {saved ? <p className="text-sm text-success">Settings saved.</p> : null}
        <Button onClick={() => void send()} disabled={loading || form.name.trim() === ''}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
