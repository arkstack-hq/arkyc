import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, Loading } from '@/components/States'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import type { Project, ProjectBranding, ProjectSettings, VerificationThresholds } from '@arkyc/types'
import { DEFAULT_PRIMARY_COLOR, DEFAULT_VELOCITY_SETTINGS, DEFAULT_VERIFICATION_THRESHOLDS } from '@arkyc/types'
import { Theme } from '@arkyc/widget'
import { Projects, errorMessage } from '@/lib/api'
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
  livenessRejectThreshold: string
  faceMatchThreshold: string
  faceMatchRejectThreshold: string
  addressThreshold: string
  allowedOrigins: string
  handoffEnabled: boolean
  handoffAllowDesktop: boolean
  velocityMaxSessions: string
  velocityWindowMinutes: string
}

/** The thresholds every project has a value for (the optional reject floor is edited separately). */
type ScoreThreshold = Exclude<keyof VerificationThresholds, 'faceMatchRejectThreshold'>

const THRESHOLD_FIELDS: { key: ScoreThreshold; label: string; description: string }[] = [
  {
    key: 'documentQualityThreshold',
    label: 'Document quality',
    description: 'Blurry, dark or cropped captures below this go to review.',
  },
  {
    key: 'ocrConfidenceThreshold',
    label: 'OCR confidence',
    description: 'Documents read with less confidence than this go to review.',
  },
  {
    key: 'livenessThreshold',
    label: 'Liveness',
    description: 'Selfies scoring below this as a live person go to review.',
  },
  {
    key: 'livenessRejectThreshold',
    label: 'Liveness reject floor',
    description:
      'Selfies that fail below this are declined, and those between this and Liveness go to a reviewer. Laptop webcams often score just under 0.5.',
  },
  {
    key: 'faceMatchThreshold',
    label: 'Face match',
    description: 'Selfie and document portrait similarity needed to auto-approve.',
  },
  {
    key: 'addressThreshold',
    label: 'Address',
    description: 'Address confidence needed to auto-verify, unless a workflow sets its own.',
  },
]

/**
 * Force a freshly uploaded logo to reload. A local-disk logo keeps the same URL
 * across re-uploads, so it gets a version param. A presigned S3/R2 URL is already
 * unique per response, and any added query param would invalidate its signature,
 * so it is returned untouched.
 */
/**
 * What's wrong with a threshold input, or null when it's valid. Blank is valid: it
 * means the default (or, for the reject floor, off). Mirrors the API's checks so
 * a bad value is caught here rather than as a 422 on save.
 */
function thresholdError(raw: string, max = 1, maxLabel?: string): string | null {
  const value = raw.trim()
  if (value === '') return null

  const score = Number(value)
  if (!Number.isFinite(score)) return 'Enter a number, e.g. 0.75.'
  if (score < 0) return 'Must be 0 or more.'
  if (score > max) return maxLabel ?? `Must be ${max} or less.`

  return null
}

function withCacheBust(url: string | null): string | null {
  if (!url || /[?&]x-(amz|goog)-signature=/i.test(url)) return url
  try {
    const parsed = new URL(url, window.location.href)
    parsed.searchParams.set('v', String(Date.now()))
    return parsed.toString()
  } catch {
    return url
  }
}

function formFromProject(project: Project): FormState {
  const thresholds = { ...DEFAULT_VERIFICATION_THRESHOLDS, ...(project.settings?.thresholds ?? {}) }
  return {
    name: project.name ?? '',
    brandName: project.branding?.name ?? '',
    showBranding: project.branding?.show_branding !== false,
    primaryColor: project.branding?.primary_color ?? DEFAULT_PRIMARY_COLOR,
    theme: project.branding?.theme ?? 'light',
    borderRadius: project.branding?.border_radius != null ? String(project.branding.border_radius) : '',
    documentQualityThreshold: String(thresholds.documentQualityThreshold),
    ocrConfidenceThreshold: String(thresholds.ocrConfidenceThreshold),
    livenessThreshold: String(thresholds.livenessThreshold),
    livenessRejectThreshold: String(
      thresholds.livenessRejectThreshold ?? DEFAULT_VERIFICATION_THRESHOLDS.livenessRejectThreshold,
    ),
    faceMatchThreshold: String(thresholds.faceMatchThreshold),
    faceMatchRejectThreshold:
      thresholds.faceMatchRejectThreshold != null ? String(thresholds.faceMatchRejectThreshold) : '',
    addressThreshold: String(thresholds.addressThreshold),
    allowedOrigins: (project.settings?.allowed_origins ?? []).join(', '),
    handoffEnabled: project.settings?.handoff?.enabled === true,
    handoffAllowDesktop: project.settings?.handoff?.allow_desktop !== false,
    velocityMaxSessions: String(project.settings?.velocity?.max_sessions ?? DEFAULT_VELOCITY_SETTINGS.max_sessions),
    velocityWindowMinutes: String(
      project.settings?.velocity?.window_minutes ?? DEFAULT_VELOCITY_SETTINGS.window_minutes,
    ),
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

      // Every threshold is sent, so a value reset to its default replaces an earlier override.
      const thresholds = Object.fromEntries(
        THRESHOLD_FIELDS.map(({ key }) => {
          const value = f[key].trim()

          return [key, value === '' ? DEFAULT_VERIFICATION_THRESHOLDS[key] : Number(value)]
        }),
      ) as unknown as VerificationThresholds
      // Blank clears the floor (null), handing the verdict back to the face-match driver.
      const rejectFloor = f.faceMatchRejectThreshold.trim()
      thresholds.faceMatchRejectThreshold = rejectFloor === '' ? null : Number(rejectFloor)

      const allowed_origins = f.allowedOrigins
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)

      const settings: ProjectSettings = {
        ...(project.settings ?? {}),
        allowed_origins,
        handoff: { enabled: f.handoffEnabled, allow_desktop: f.handoffAllowDesktop },
        velocity: { max_sessions: Number(f.velocityMaxSessions), window_minutes: Number(f.velocityWindowMinutes) },
      }
      settings.thresholds = thresholds

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
  onLogoUploaded(({ data }) => setLogoUrl(withCacheBust(data.branding?.logo_url ?? null)))

  // The reject floor can't sit above the face-match threshold (blank = its default).
  const faceMatchInput = Number(form.faceMatchThreshold.trim() || DEFAULT_VERIFICATION_THRESHOLDS.faceMatchThreshold)
  const floorMax = Number.isFinite(faceMatchInput) ? Math.min(1, Math.max(0, faceMatchInput)) : 1
  // The liveness floor can't sit above the liveness threshold either.
  const livenessInput = Number(form.livenessThreshold.trim() || DEFAULT_VERIFICATION_THRESHOLDS.livenessThreshold)
  const livenessFloorMax = Number.isFinite(livenessInput) ? Math.min(1, Math.max(0, livenessInput)) : 1

  const thresholdErrors: Record<string, string | null> = {
    ...Object.fromEntries(THRESHOLD_FIELDS.map(({ key }) => [key, thresholdError(form[key])])),
    livenessRejectThreshold: thresholdError(
      form.livenessRejectThreshold,
      livenessFloorMax,
      `Keep this at or below Liveness (${livenessFloorMax}).`,
    ),
    faceMatchRejectThreshold: thresholdError(
      form.faceMatchRejectThreshold,
      floorMax,
      `Keep this at or below Face match (${floorMax}).`,
    ),
  }
  const thresholdsInvalid = Object.values(thresholdErrors).some(Boolean)

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
            <CardDescription>
              Scores from 0 to 1 a check must reach for a session to be approved automatically. Anything lower goes to
              manual review. Raise them to review more sessions, lower them to approve more automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            {THRESHOLD_FIELDS.map((field) => {
              const fallback = DEFAULT_VERIFICATION_THRESHOLDS[field.key]
              const custom = form[field.key].trim() !== '' && Number(form[field.key]) !== fallback

              return (
                <Field key={field.key}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
                    {custom ? (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => set(field.key, String(fallback))}
                      >
                        Reset to {fallback}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Default</span>
                    )}
                  </div>
                  <InputGroup>
                    <InputGroupInput
                      id={field.key}
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={form[field.key]}
                      placeholder={String(fallback)}
                      aria-invalid={Boolean(thresholdErrors[field.key])}
                      aria-describedby={`${field.key}-hint`}
                      onChange={(e) => set(field.key, e.target.value)}
                    />
                  </InputGroup>
                  <p id={`${field.key}-hint`} className="text-xs text-muted-foreground">
                    {field.description} <span className="whitespace-nowrap">0 to 1 · default {fallback}</span>
                  </p>
                  {thresholdErrors[field.key] ? <FieldError>{thresholdErrors[field.key]}</FieldError> : null}
                </Field>
              )
            })}
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="faceMatchRejectThreshold">Face match reject floor</FieldLabel>
                {form.faceMatchRejectThreshold.trim() !== '' ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => set('faceMatchRejectThreshold', '')}
                  >
                    Clear
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Off</span>
                )}
              </div>
              <InputGroup>
                <InputGroupInput
                  id="faceMatchRejectThreshold"
                  type="number"
                  min={0}
                  max={floorMax}
                  step={0.05}
                  value={form.faceMatchRejectThreshold}
                  placeholder="Off"
                  aria-invalid={Boolean(thresholdErrors.faceMatchRejectThreshold)}
                  aria-describedby="faceMatchRejectThreshold-hint"
                  onChange={(e) => set('faceMatchRejectThreshold', e.target.value)}
                />
              </InputGroup>
              <p id="faceMatchRejectThreshold-hint" className="text-xs text-muted-foreground">
                Matches below this are declined, and those between this and Face match go to a reviewer. Leave it empty
                to decline any match that fails. 0.3 works well for ID cards.
              </p>
              {thresholdErrors.faceMatchRejectThreshold ? (
                <FieldError>{thresholdErrors.faceMatchRejectThreshold}</FieldError>
              ) : null}
            </Field>
            <FieldError className="sm:col-span-2" errors={error?.list?.thresholds} />
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

        <Card>
          <CardHeader>
            <CardTitle>Session velocity</CardTitle>
            <CardDescription>
              Flag a session for review when one network address opens more sessions than this, under different user
              references, within the window.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="velocity-max">Sessions per address</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="velocity-max"
                  type="number"
                  min={1}
                  value={form.velocityMaxSessions}
                  onChange={(e) => set('velocityMaxSessions', e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="velocity-window">Window (minutes)</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="velocity-window"
                  type="number"
                  min={1}
                  value={form.velocityWindowMinutes}
                  onChange={(e) => set('velocityWindowMinutes', e.target.value)}
                />
              </InputGroup>
            </Field>
            <FieldError errors={error?.list?.settings} />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          {canEdit ? (
            <Button type="submit" disabled={saving || thresholdsInvalid}>
              {saving ? <Spinner /> : null}
              Save
            </Button>
          ) : null}
          {saved ? <span className="text-sm text-success">Saved.</span> : null}
          {error && !error.errors ? <FieldError>{errorMessage(error, 'Failed to save.')}</FieldError> : null}
        </div>
      </form>
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
