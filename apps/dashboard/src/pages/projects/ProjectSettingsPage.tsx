import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, useRequest } from 'alova/client'
import type { Project, ProjectBranding, ProjectSettings, VerificationThresholds } from '@arkyc/types'
import { Projects, errorMessage } from '@/lib/api'
import { useTenant, useTenantId } from '@/contexts/tenant-context'
import { Loading, ErrorState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

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
  handoffDesktopOnly: boolean
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
    primaryColor: project.branding?.primary_color ?? '#000000',
    theme: project.branding?.theme ?? 'light',
    borderRadius: project.branding?.border_radius != null ? String(project.branding.border_radius) : '',
    documentQualityThreshold:
      thresholds.documentQualityThreshold != null ? String(thresholds.documentQualityThreshold) : '',
    ocrConfidenceThreshold: thresholds.ocrConfidenceThreshold != null ? String(thresholds.ocrConfidenceThreshold) : '',
    livenessThreshold: thresholds.livenessThreshold != null ? String(thresholds.livenessThreshold) : '',
    faceMatchThreshold: thresholds.faceMatchThreshold != null ? String(thresholds.faceMatchThreshold) : '',
    allowedOrigins: (project.settings?.allowed_origins ?? []).join(', '),
    handoffEnabled: project.settings?.handoff?.enabled === true,
    handoffDesktopOnly: project.settings?.handoff?.desktop_only !== false,
  }
}

function ProjectSettingsForm({ project }: { project: Project }) {
  const tenantId = useTenantId()
  const { can } = useTenant()
  const { projectId } = useParams()
  const [saved, setSaved] = useState(false)

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
        handoff: { enabled: f.handoffEnabled, desktop_only: f.handoffDesktopOnly },
      }
      if (Object.keys(thresholds).length > 0) settings.thresholds = thresholds

      return Projects.update(tenantId, projectId!, {
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
  })

  // Logo upload is a separate multipart action (not part of the JSON form save).
  const [logoUrl, setLogoUrl] = useState<string | null>(project.branding?.logo_url ?? null)
  const {
    send: uploadLogo,
    loading: uploadingLogo,
    error: logoError,
    onSuccess: onLogoUploaded,
  } = useRequest((file: File) => Projects.uploadLogo(tenantId, projectId!, file), { immediate: false })
  onLogoUploaded(({ data }) => setLogoUrl((data as Project).branding?.logo_url ?? null))

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
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
          <Field>
            <FieldLabel htmlFor="primary-color">Primary color</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="primary-color"
                type="text"
                value={form.primaryColor}
                onChange={(e) => set('primaryColor', e.target.value)}
                placeholder="#000000"
              />
            </InputGroup>
          </Field>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="theme">Theme</Label>
            <Select id="theme" value={form.theme} onChange={(e) => set('theme', e.target.value as 'light' | 'dark')}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </div>
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logo">Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {logoUrl ? (
                  <img src={logoUrl} alt="Project logo" className="size-full object-contain" />
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
            Let users continue a verification on another device by scanning a QR code (e.g. start on desktop, finish on
            a phone).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.handoffEnabled}
              onChange={(e) => set('handoffEnabled', e.target.checked)}
            />
            Allow continuing on another device
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.handoffDesktopOnly}
              disabled={!form.handoffEnabled}
              onChange={(e) => set('handoffDesktopOnly', e.target.checked)}
            />
            Only offer the handoff on desktop devices
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
  )
}

export default function ProjectSettingsPage() {
  const tenantId = useTenantId()
  const { projectId } = useParams()

  const {
    data: project,
    loading,
    error,
  } = useRequest(Projects.get(tenantId, projectId!), {
    immediate: !!projectId,
  })

  if (loading || !project) return <Loading />
  if (error) return <ErrorState error={error} />

  return <ProjectSettingsForm project={project} />
}
