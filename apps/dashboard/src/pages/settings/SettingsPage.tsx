import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'alova/client'
import { Organizations, errorMessage } from '@/lib/api'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'
import { PageHeader } from '@/components/States'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { DEFAULT_FACE_EMBEDDING_SETTINGS } from '@arkyc/types'

export default function SettingsPage() {
  const organizationId = useOrganizationId()
  const { organization, can } = useOrganization()

  const [saved, setSaved] = useState(false)

  const { form, updateForm, send, loading, error, update, onSuccess } = useForm(
    (formData) => Organizations.update(organizationId, { name: formData.name }),
    { initialForm: { name: organization?.name ?? '' } },
  )

  onSuccess(() => setSaved(true))

  const canUpdate = can('settings.update')

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title="Settings" description="Manage your organization." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>General organization details.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="organization-name">Name</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Building2 />
                </InputGroupAddon>
                <InputGroupInput
                  id="organization-name"
                  value={form.name}
                  onChange={(e) => {
                    updateForm({ name: e.target.value })
                    setSaved(false)
                    if (error?.errors) error.delete('name', update)
                  }}
                  disabled={!canUpdate}
                />
              </InputGroup>
              <FieldError errors={error?.list?.name} />
            </Field>
            {error && !error.errors ? <FieldError>{errorMessage(error, 'Failed to save.')}</FieldError> : null}
            {saved ? <p className="text-sm text-success">Settings saved.</p> : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => void send()} disabled={!canUpdate || loading || form.name.trim() === ''}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access control</CardTitle>
            <CardDescription>Roles and permissions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link to="roles">
              <Button variant="outline" className="w-full justify-start">
                Manage roles
              </Button>
            </Link>
            <Link to="permissions">
              <Button variant="outline" className="w-full justify-start">
                Permission catalog
              </Button>
            </Link>
          </CardContent>
        </Card>

        <FaceEmbeddingsCard canUpdate={canUpdate} />
      </div>
    </div>
  )
}

/** Opt-in storage of face embeddings for duplicate-face detection. */
function FaceEmbeddingsCard({ canUpdate }: { canUpdate: boolean }) {
  const organizationId = useOrganizationId()
  const { organization } = useOrganization()
  const current = { ...DEFAULT_FACE_EMBEDDING_SETTINGS, ...(organization?.settings?.face_embeddings ?? {}) }
  const [saved, setSaved] = useState(false)

  const { form, updateForm, send, loading, error, onSuccess } = useForm(
    (formData) =>
      Organizations.update(organizationId, {
        settings: {
          face_embeddings: { enabled: formData.enabled, retention_days: Number(formData.retentionDays) },
        },
      }),
    { initialForm: { enabled: current.enabled, retentionDays: String(current.retention_days) } },
  )

  onSuccess(() => setSaved(true))

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Duplicate face detection</CardTitle>
        <CardDescription>
          Store a face embedding for each verified selfie to catch one face behind several identities. Embeddings are
          biometric data under GDPR Article 9 and laws like BIPA: make sure you have a lawful basis and consent before
          turning this on.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enabled}
            disabled={!canUpdate}
            onChange={(e) => {
              updateForm({ enabled: e.target.checked })
              setSaved(false)
            }}
          />
          Store face embeddings and flag duplicate faces
        </label>
        <Field>
          <FieldLabel htmlFor="embedding-retention">Keep embeddings for (days)</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="embedding-retention"
              type="number"
              min={1}
              max={3650}
              value={form.retentionDays}
              disabled={!canUpdate}
              onChange={(e) => {
                updateForm({ retentionDays: e.target.value })
                setSaved(false)
              }}
            />
          </InputGroup>
          <FieldError errors={error?.list?.settings} />
        </Field>
        {error && !error.errors ? <FieldError>{errorMessage(error, 'Failed to save.')}</FieldError> : null}
        {saved ? <p className="text-sm text-success">Settings saved.</p> : null}
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={() => void send()} disabled={!canUpdate || loading}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </CardFooter>
    </Card>
  )
}
