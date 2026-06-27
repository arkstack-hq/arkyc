import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, Loading } from '@/components/States'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import type { Project, ProjectBranding, ProjectSettings, VerificationThresholds } from '@arkyc/types'
import { Theme } from '@arkyc/widget'
import { AiAccess, type AiAccessGrant, type AiAccessStatus, Projects, errorMessage } from '@/lib/api'
import { useForm, useRequest } from 'alova/client'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'
import { PopoverPicker } from '@/components/SpeechBubble'

const AI_STATUS: Record<
  AiAccessStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted'; copy: string }
> = {
  none: {
    label: 'Not enabled',
    variant: 'muted',
    copy: 'AI document processing improves document reads, alowing for better pass rates, you can request for access here.',
  },
  pending: {
    label: 'Requested',
    variant: 'warning',
    copy: 'Your request is awaiting platform review. We’ll enable processing once it’s approved.',
  },
  granted: {
    label: 'Enabled',
    variant: 'success',
    copy: 'AI document processing is enabled for this project.',
  },
  revoked: {
    label: 'Revoked',
    variant: 'destructive',
    copy: 'AI processing access was revoked for this project. You can request it again.',
  },
}

/** Owner view of AI document-processing access: status + request. */
function AiProcessingCard({
  organizationId,
  projectId,
  canRequest,
}: {
  organizationId: string
  projectId: string
  canRequest: boolean
}) {
  const { data: access, update } = useRequest(AiAccess.status(organizationId, projectId), {
    initialData: { status: 'none' } as AiAccessGrant,
  })
  const {
    send: request,
    loading: requesting,
    error,
  } = useRequest(() => AiAccess.request(organizationId, projectId), { immediate: false }).onComplete(
    ({ error, data }) => {
      if (data) update({ data })
      toast.success(!error ? 'Request Sent' : 'Unable to sent request at this time, try later.')
    },
  )

  const meta = AI_STATUS[access.status] ?? AI_STATUS.none
  const canAct = canRequest && (access.status === 'none' || access.status === 'revoked')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>AI document processing</CardTitle>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <CardDescription>{meta.copy}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        {canAct ? (
          <Button type="button" disabled={requesting} onClick={() => void request()}>
            {requesting ? <Spinner /> : null}
            {access.status === 'revoked' ? 'Request again' : 'Request access'}
          </Button>
        ) : null}
        {error ? <FieldError>{errorMessage(error, 'Failed to send request.')}</FieldError> : null}
      </CardContent>
    </Card>
  )
}

interface FormState {
  name: string
  brandName: string
  showBranding: boolean
  primaryColor: string
  theme: 'light' | 'dark'
  borderRadius: string
  documentQualityThreshold: string
  ocrConfidenceThreshold: string
  livenessThreshold: string
  faceMatchThreshold: string
  allowedOrigins: string
  handoffEnabled: boolean
  handoffAllowDesktop: boolean
}

const THRESHOLD_FIELDS: { key: keyof VerificationThresholds; label: string }[] = [
  { key: 'documentQualityThreshold', label: 'Document quality' },
  { key: 'ocrConfidenceThreshold', label: 'OCR confidence' },
  { key: 'livenessThreshold', label: 'Liveness' },
  { key: 'faceMatchThreshold', label: 'Face match' },
]

function formFromProject(project: Project): FormState {
  const thresholds = project.settings?.thresholds ?? {}
  return {
    name: project.name ?? '',
    brandName: project.branding?.name ?? '',
    showBranding: project.branding?.show_branding !== false,
    primaryColor: project.branding?.primary_color ?? 'rgb(255, 255, 255)',
    theme: project.branding?.theme ?? 'light',
    borderRadius: project.branding?.border_radius != null ? String(project.branding.border_radius) : '',
    documentQualityThreshold:
      thresholds.documentQualityThreshold != null ? String(thresholds.documentQualityThreshold) : '',
    ocrConfidenceThreshold: thresholds.ocrConfidenceThreshold != null ? String(thresholds.ocrConfidenceThreshold) : '',
    livenessThreshold: thresholds.livenessThreshold != null ? String(thresholds.livenessThreshold) : '',
    faceMatchThreshold: thresholds.faceMatchThreshold != null ? String(thresholds.faceMatchThreshold) : '',
    allowedOrigins: (project.settings?.allowed_origins ?? []).join(', '),
    handoffEnabled: project.settings?.handoff?.enabled === true,
    handoffAllowDesktop: project.settings?.handoff?.allow_desktop !== false,
  }
}

function ProjectSettingsForm({ project }: { project: Project }) {
  const organizationId = useOrganizationId()
  const { can } = useOrganization()
  const { projectId } = useParams()
  const rgbBase = Theme.rgb(formFromProject(project))
  const [saved, setSaved] = useState(false)
  const [color, setColor] = useState(rgbBase.obj)

  const {
    form,
    updateForm,
    send: save,
    loading: saving,
    error,
    update,
    onSuccess,
  } = useForm(
    (f) => {
      const branding: ProjectBranding = {
        primary_color: f.primaryColor,
        theme: f.theme,
        name: f.brandName.trim() || null,
        show_branding: f.showBranding,
      }
      if (f.borderRadius.trim() !== '') branding.border_radius = Number(f.borderRadius)

      const thresholds: Partial<VerificationThresholds> = {}
      if (f.documentQualityThreshold.trim() !== '')
        thresholds.documentQualityThreshold = Number(f.documentQualityThreshold)
      if (f.ocrConfidenceThreshold.trim() !== '') thresholds.ocrConfidenceThreshold = Number(f.ocrConfidenceThreshold)
      if (f.livenessThreshold.trim() !== '') thresholds.livenessThreshold = Number(f.livenessThreshold)
      if (f.faceMatchThreshold.trim() !== '') thresholds.faceMatchThreshold = Number(f.faceMatchThreshold)

      const allowed_origins = f.allowedOrigins
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)

      const settings: ProjectSettings = {
        ...(project.settings ?? {}),
        allowed_origins,
        handoff: { enabled: f.handoffEnabled, allow_desktop: f.handoffAllowDesktop },
      }
      if (Object.keys(thresholds).length > 0) settings.thresholds = thresholds

      return Projects.update(organizationId, projectId!, {
        name: f.name.trim(),
        branding,
        settings,
      })
    },
    { initialForm: formFromProject(project) },
  )

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    updateForm({ [key]: value } as Partial<FormState>)
    setSaved(false)
    if (error?.errors) error.delete(key, update)
  }

  const canEdit = can('projects.update')

  onSuccess(() => {
    setSaved(true)
    toast.success('Settings Saved Successfully.')
  })

  // Logo upload is a separate multipart action (not part of the JSON form save).
  const [logoUrl, setLogoUrl] = useState<string | null>(project.branding?.logo_url ?? null)
  const {
    send: uploadLogo,
    loading: uploadingLogo,
    error: logoError,
    onSuccess: onLogoUploaded,
  } = useRequest((file: File) => Projects.uploadLogo(organizationId, projectId!, file), { immediate: false })
  onLogoUploaded(({ data }) => setLogoUrl(data.branding?.logo_url ?? null))

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic project information.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="name"
                  value={form.name}
                  aria-invalid={!!error?.flat?.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </InputGroup>
              <FieldError errors={error?.list?.name} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>How the verification widget appears.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="brand-name">Display name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="brand-name"
                  type="text"
                  value={form.brandName}
                  onChange={(e) => set('brandName', e.target.value)}
                  placeholder="Company / product shown in the widget header"
                />
              </InputGroup>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.showBranding}
                onChange={(e) => set('showBranding', e.target.checked)}
              />
              Show name &amp; logo in the widget header
            </label>

            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="primary-color">Primary color</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="primary-color"
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => set('primaryColor', e.target.value)}
                    placeholder="rgb(255, 255, 255)"
                    readOnly
                  />

                  <InputGroupAddon align="inline-end">
                    <PopoverPicker
                      color={color}
                      onChange={(e) => {
                        setColor(e)
                        set('primaryColor', `rgb(${[e.r, e.g, e.b].join(',')})`)
                      }}
                    />
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="theme">Theme</FieldLabel>
                <Select
                  id="theme"
                  value={form.theme}
                  onChange={(e) => set('theme', e.target.value as 'light' | 'dark')}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="border-radius">Border radius</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="border-radius"
                    type="number"
                    value={form.borderRadius}
                    onChange={(e) => set('borderRadius', e.target.value)}
                  />
                </InputGroup>
              </Field>
            </FieldGroup>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="logo">Logo</Label>
              <div className="flex items-center gap-4">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {logoUrl ? (
                    <img
                      src={logoUrl + '?logo=' + Date.now()}
                      alt="Project logo"
                      className="size-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </div>
                {canEdit ? (
                  <div className="flex flex-col gap-1.5">
                    <input
                      id="logo"
                      type="file"
                      accept="image/*"
                      disabled={uploadingLogo}
                      className="text-sm"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void uploadLogo(file)
                        e.target.value = ''
                      }}
                    />
                    {uploadingLogo ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Spinner /> Uploading…
                      </span>
                    ) : null}
                    {logoError ? <FieldError>{errorMessage(logoError, 'Upload failed.')}</FieldError> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification thresholds</CardTitle>
            <CardDescription>Override the default decision-engine thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {THRESHOLD_FIELDS.map((field) => (
              <Field key={field.key}>
                <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={field.key}
                    type="number"
                    step="any"
                    value={form[field.key as keyof FormState] as string}
                    onChange={(e) => set(field.key as keyof FormState, e.target.value)}
                  />
                </InputGroup>
              </Field>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allowed origins</CardTitle>
            <CardDescription>Comma-separated list of origins permitted to embed the widget.</CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="allowed-origins">Origins</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="allowed-origins"
                  value={form.allowedOrigins}
                  onChange={(e) => set('allowedOrigins', e.target.value)}
                  placeholder="https://app.example.com, https://example.com"
                />
              </InputGroup>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cross-device handoff</CardTitle>
            <CardDescription>
              On desktop, lead with a QR code so users can finish the verification on their phone (which usually has the
              better camera).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.handoffEnabled}
                onChange={(e) => set('handoffEnabled', e.target.checked)}
              />
              Offer desktop users a QR to continue on their phone
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.handoffAllowDesktop}
                disabled={!form.handoffEnabled}
                onChange={(e) => set('handoffAllowDesktop', e.target.checked)}
              />
              Also let them continue on the desktop device
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          {canEdit ? (
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : null}
              Save
            </Button>
          ) : null}
          {saved ? <span className="text-sm text-success">Saved.</span> : null}
          {error && !error.errors ? <FieldError>{errorMessage(error, 'Failed to save.')}</FieldError> : null}
        </div>
      </form>

      <AiProcessingCard organizationId={organizationId} projectId={projectId!} canRequest={canEdit} />
    </div>
  )
}

export default function ProjectSettingsPage() {
  const organizationId = useOrganizationId()
  const { projectId } = useParams()

  const {
    data: project,
    loading,
    error,
  } = useRequest(Projects.get(organizationId, projectId!), {
    immediate: !!projectId,
  })

  if (loading || !project) return <Loading />
  if (error) return <ErrorState error={error} />

  return <ProjectSettingsForm project={project} />
}
