import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, useRequest } from 'alova/client'
import type {
  Project,
  ProjectBranding,
  ProjectSettings,
  VerificationThresholds,
} from '@arkyc/types'
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
  primaryColor: string
  theme: 'light' | 'dark'
  borderRadius: string
  documentQualityThreshold: string
  ocrConfidenceThreshold: string
  livenessThreshold: string
  faceMatchThreshold: string
  allowedOrigins: string
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
    primaryColor: project.branding?.primary_color ?? '#000000',
    theme: project.branding?.theme ?? 'light',
    borderRadius:
      project.branding?.border_radius != null ? String(project.branding.border_radius) : '',
    documentQualityThreshold:
      thresholds.documentQualityThreshold != null
        ? String(thresholds.documentQualityThreshold)
        : '',
    ocrConfidenceThreshold:
      thresholds.ocrConfidenceThreshold != null ? String(thresholds.ocrConfidenceThreshold) : '',
    livenessThreshold:
      thresholds.livenessThreshold != null ? String(thresholds.livenessThreshold) : '',
    faceMatchThreshold:
      thresholds.faceMatchThreshold != null ? String(thresholds.faceMatchThreshold) : '',
    allowedOrigins: (project.settings?.allowed_origins ?? []).join(', '),
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
      }
      if (f.borderRadius.trim() !== '') branding.border_radius = Number(f.borderRadius)

      const thresholds: Partial<VerificationThresholds> = {}
      if (f.documentQualityThreshold.trim() !== '')
        thresholds.documentQualityThreshold = Number(f.documentQualityThreshold)
      if (f.ocrConfidenceThreshold.trim() !== '')
        thresholds.ocrConfidenceThreshold = Number(f.ocrConfidenceThreshold)
      if (f.livenessThreshold.trim() !== '')
        thresholds.livenessThreshold = Number(f.livenessThreshold)
      if (f.faceMatchThreshold.trim() !== '')
        thresholds.faceMatchThreshold = Number(f.faceMatchThreshold)

      const allowed_origins = f.allowedOrigins
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)

      const settings: ProjectSettings = {
        ...(project.settings ?? {}),
        allowed_origins,
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
            <Select
              id="theme"
              value={form.theme}
              onChange={(e) => set('theme', e.target.value as 'light' | 'dark')}
            >
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
          <CardDescription>
            Comma-separated list of origins permitted to embed the widget.
          </CardDescription>
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

      <div className="flex items-center gap-3">
        {canEdit ? (
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner /> : null}
            Save
          </Button>
        ) : null}
        {saved ? <span className="text-sm text-success">Saved.</span> : null}
        {error && !error.errors ? (
          <FieldError>{errorMessage(error, 'Failed to save.')}</FieldError>
        ) : null}
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
