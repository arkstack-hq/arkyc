import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectBranding, ProjectSettings, VerificationThresholds } from '@arkyc/types'
import { api } from '@/lib/api'
import { useTenant, useTenantId } from '@/lib/tenant'
import { Loading, ErrorState } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export default function ProjectSettingsPage() {
  const tenantId = useTenantId()
  const { can } = useTenant()
  const { projectId } = useParams()
  const qc = useQueryClient()

  const projectQuery = useQuery({
    queryKey: ['project', tenantId, projectId],
    queryFn: () => api.projects.get(tenantId, projectId!),
    enabled: !!projectId,
  })

  const [form, setForm] = useState<FormState | null>(null)
  const [saved, setSaved] = useState(false)

  const project = projectQuery.data
  useEffect(() => {
    if (!project) return
    const thresholds = project.settings?.thresholds ?? {}
    setForm({
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
    })
  }, [project])

  const updateMutation = useMutation({
    mutationFn: () => {
      const f = form!
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
        ...(project?.settings ?? {}),
        allowed_origins,
      }
      if (Object.keys(thresholds).length > 0) settings.thresholds = thresholds

      return api.projects.update(tenantId, projectId!, {
        name: f.name.trim(),
        branding,
        settings,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', tenantId, projectId] })
      setSaved(true)
    },
  })

  if (projectQuery.isLoading || !form) return <Loading />
  if (projectQuery.isError) return <ErrorState error={projectQuery.error} />

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  const canEdit = can('projects.update')

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        updateMutation.mutate()
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic project information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>How the verification widget appears.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="primary-color">Primary color</Label>
            <Input
              id="primary-color"
              type="text"
              value={form.primaryColor}
              onChange={(e) => set('primaryColor', e.target.value)}
              placeholder="#000000"
            />
          </div>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="border-radius">Border radius</Label>
            <Input
              id="border-radius"
              type="number"
              value={form.borderRadius}
              onChange={(e) => set('borderRadius', e.target.value)}
            />
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
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type="number"
                step="any"
                value={form[field.key as keyof FormState] as string}
                onChange={(e) => set(field.key as keyof FormState, e.target.value)}
              />
            </div>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="allowed-origins">Origins</Label>
            <Input
              id="allowed-origins"
              value={form.allowedOrigins}
              onChange={(e) => set('allowedOrigins', e.target.value)}
              placeholder="https://app.example.com, https://example.com"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        {canEdit ? (
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Spinner /> : null}
            Save
          </Button>
        ) : null}
        {saved ? <span className="text-sm text-success">Saved.</span> : null}
        {updateMutation.isError ? (
          <span className="text-sm text-destructive">
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : 'Failed to save.'}
          </span>
        ) : null}
      </div>
    </form>
  )
}
