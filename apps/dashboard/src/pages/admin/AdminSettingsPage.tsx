import { Admin, errorMessage } from '@/lib/api'
import type { EnvItem } from '@/lib/api'
import type { CaptureModel, GlobalSettings, RealtimeTransport } from '@arkyc/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { useForm, useRequest } from 'alova/client'

import { Badge } from '@/components/ui/badge'
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

  return (
    <div className="flex flex-col gap-10">
      <SettingsForm settings={data} />
      <EnvironmentPanel />
    </div>
  )
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
        assets: { url_ttl_seconds: formData.assetTtl },
      }),
    {
      initialForm: {
        name: settings.platform.name,
        supportEmail: settings.platform.support_email ?? '',
        signupsEnabled: settings.platform.signups_enabled,
        transport: settings.realtime.transport,
        captureModel: settings.capture.model,
        assetTtl: settings.assets.url_ttl_seconds,
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

        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
            <CardDescription>Signed links to captured document and selfie images.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="asset-ttl">Asset link lifetime (seconds)</FieldLabel>
              <Input
                id="asset-ttl"
                type="number"
                min={60}
                max={86400}
                step={60}
                value={form.assetTtl}
                onChange={(e) => {
                  updateForm({ assetTtl: Number(e.target.value) })
                  dirtyReset()
                  if (error?.errors) error.delete('assets.url_ttl_seconds', update)
                }}
              />
              <FieldError errors={error?.list?.['assets.url_ttl_seconds']} />
              <p className="text-xs text-muted-foreground">
                How long a signed image URL stays valid, from 60 seconds to 24 hours (86400). Applies to newly issued
                links; existing links keep their original window.
              </p>
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

/**
 * Read-only snapshot of the API's effective runtime configuration, so you can
 * eyeball config drift between environments. Secrets are never sent — they show
 * only as `Configured` / `Not set`.
 */
function EnvironmentPanel() {
  const { data, error, loading, send } = useRequest(Admin.environment())

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Environment</h2>
          <p className="text-sm text-muted-foreground">
            The API's effective runtime configuration. Use it to spot config drift — secrets are shown only as
            configured or not.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void send()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <FieldError>{errorMessage(error, 'Failed to load environment.')}</FieldError>
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="muted">NODE_ENV: {data.node_env}</Badge>
            <Badge variant="muted">v{data.version}</Badge>
            <span>Snapshot taken {new Date(data.generated_at).toLocaleString()}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.sections.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="flex flex-col divide-y divide-border text-sm">
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
                      >
                        <dt className="text-muted-foreground">{item.label}</dt>
                        <dd className="min-w-0 text-right">
                          <EnvValue item={item} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Render one config value: plain values as mono text, secrets/warnings as badges. */
function EnvValue({ item }: { item: EnvItem }) {
  switch (item.status) {
    case 'warn':
      return <Badge variant="warning">{item.value}</Badge>
    case 'set':
      return <Badge variant="success">{item.value}</Badge>
    case 'unset':
      return <Badge variant="muted">{item.value}</Badge>
    default:
      return <code className="truncate font-mono text-xs text-foreground">{item.value}</code>
  }
}
