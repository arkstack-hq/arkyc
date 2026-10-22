import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useRequest } from 'alova/client'
import { BadgeCheck, FileText } from 'lucide-react'
import type { BusinessVerification, BusinessVerificationDocument, BusinessVerificationStatus } from '@arkyc/types'
import { countries } from '@arkyc/widget'
import { BusinessVerifications, errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import { useOrganization, useOrganizationId } from '@/contexts/organization-context'
import { ErrorState, Loading, PageHeader } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

export const VERIFICATION_STATUS: Record<
  BusinessVerificationStatus,
  { label: string; variant: 'muted' | 'warning' | 'success' | 'destructive' }
> = {
  unverified: { label: 'Not verified', variant: 'muted' },
  pending: { label: 'Under review', variant: 'warning' },
  verified: { label: 'Verified', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

export const DOCUMENT_LABEL: Record<BusinessVerificationDocument, string> = {
  incorporation: 'Certificate of incorporation',
  data_protection: 'Data protection registration',
}

type FieldKey =
  | 'legal_name'
  | 'country'
  | 'registration_number'
  | 'registered_address'
  | 'website'
  | 'dpo_name'
  | 'dpo_email'
  | 'privacy_policy_url'
  | 'data_protection_registration'

const EMPTY: Record<FieldKey, string> = {
  legal_name: '',
  country: '',
  registration_number: '',
  registered_address: '',
  website: '',
  dpo_name: '',
  dpo_email: '',
  privacy_policy_url: '',
  data_protection_registration: '',
}

/** Prove the organization may handle personal data, to verify identities in production. */
export default function BusinessVerificationPage() {
  const organizationId = useOrganizationId()
  const { data, loading, error, send } = useRequest(BusinessVerifications.state(organizationId))

  if (error) return <ErrorState error={error} />
  if (loading || !data) return <Loading />

  const status = VERIFICATION_STATUS[data.status]
  const canSubmit = data.status === 'unverified' || data.status === 'rejected'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-8">
      <PageHeader
        title="Business verification"
        description="Arkyc handles personal data, so every organization proves it is a business that may process it before verifying identities in production."
        actions={
          <Link to=".." relative="path" className="text-sm text-primary hover:underline">
            ← Settings
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Status</CardTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <CardDescription>
            {data.status === 'verified'
              ? `Verified ${formatDateTime(data.verified_at)}. Production projects are open.`
              : data.status === 'pending'
                ? 'A platform admin is reviewing your submission. You will be notified when it is decided.'
                : data.required
                  ? 'Production projects need a verified business. Development and staging projects stay open meanwhile.'
                  : 'Verification is optional on this platform, but recommended before going live.'}
          </CardDescription>
        </CardHeader>
        {data.status === 'rejected' && data.latest?.review_note ? (
          <CardContent>
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Reviewer note: {data.latest.review_note}
            </p>
          </CardContent>
        ) : null}
      </Card>

      {canSubmit ? (
        <VerificationForm
          organizationId={organizationId}
          previous={data.status === 'rejected' ? data.latest : null}
          onSubmitted={() => void send()}
        />
      ) : data.latest ? (
        <SubmissionSummary
          verification={data.latest}
          open={(kind) => BusinessVerifications.document(organizationId, kind)}
        />
      ) : null}
    </div>
  )
}

function VerificationForm({
  organizationId,
  previous,
  onSubmitted,
}: {
  organizationId: string
  previous: BusinessVerification | null
  onSubmitted: () => void
}) {
  const { can } = useOrganization()
  const [values, setValues] = useState<Record<FieldKey, string>>(() =>
    previous
      ? (Object.fromEntries(Object.keys(EMPTY).map((key) => [key, String(previous[key as FieldKey] ?? '')])) as Record<
          FieldKey,
          string
        >)
      : EMPTY,
  )
  const [incorporation, setIncorporation] = useState<File | null>(null)
  const [dataProtection, setDataProtection] = useState<File | null>(null)

  const { send, loading, error, onSuccess } = useRequest(
    () => {
      const form = new FormData()
      for (const [key, value] of Object.entries(values)) if (value.trim()) form.append(key, value.trim())
      if (incorporation) form.append('incorporation_document', incorporation)
      if (dataProtection) form.append('data_protection_document', dataProtection)

      return BusinessVerifications.submit(organizationId, form)
    },
    { immediate: false },
  )
  onSuccess(onSubmitted)

  const errors =
    error && 'list' in error ? (error as { list?: Record<string, Array<{ message?: string }>> }).list : undefined
  const set = (key: FieldKey) => (value: string) => setValues((current) => ({ ...current, [key]: value }))

  if (!can('organizations.update')) {
    return (
      <p className="text-sm text-muted-foreground">
        Ask an organization owner or admin to submit the business verification.
      </p>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
      className="flex flex-col gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
          <CardDescription>As shown on your registration with the company registry.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Legal name"
            id="legal_name"
            value={values.legal_name}
            onChange={set('legal_name')}
            errors={errors}
          />
          <Field>
            <FieldLabel htmlFor="country">Country of registration</FieldLabel>
            <Select id="country" value={values.country} onChange={(e) => set('country')(e.target.value)} required>
              <option value="">Select a country</option>
              {countries.map((country) => (
                <option key={country.iso2} value={country.iso2}>
                  {country.name}
                </option>
              ))}
            </Select>
            <FieldError errors={errors?.country} />
          </Field>
          <TextField
            label="Registration number"
            id="registration_number"
            value={values.registration_number}
            onChange={set('registration_number')}
            errors={errors}
          />
          <TextField
            label="Website"
            id="website"
            type="url"
            placeholder="https://"
            value={values.website}
            onChange={set('website')}
            errors={errors}
          />
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="registered_address">Registered address</FieldLabel>
            <Textarea
              id="registered_address"
              rows={2}
              value={values.registered_address}
              onChange={(e) => set('registered_address')(e.target.value)}
              required
            />
            <FieldError errors={errors?.registered_address} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data protection</CardTitle>
          <CardDescription>Who answers for personal data, and how you protect it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Data protection officer"
            id="dpo_name"
            value={values.dpo_name}
            onChange={set('dpo_name')}
            errors={errors}
          />
          <TextField
            label="Officer's email"
            id="dpo_email"
            type="email"
            value={values.dpo_email}
            onChange={set('dpo_email')}
            errors={errors}
          />
          <TextField
            label="Privacy policy URL"
            id="privacy_policy_url"
            type="url"
            placeholder="https://"
            value={values.privacy_policy_url}
            onChange={set('privacy_policy_url')}
            errors={errors}
          />
          <TextField
            label="Data protection registration (optional)"
            id="data_protection_registration"
            required={false}
            placeholder="If your regulator issues one"
            value={values.data_protection_registration}
            onChange={set('data_protection_registration')}
            errors={errors}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>PDF, PNG or JPG, up to 10 MB each.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FileField
            label={DOCUMENT_LABEL.incorporation}
            id="incorporation_document"
            file={incorporation}
            onChange={setIncorporation}
            errors={errors}
            required
          />
          <FileField
            label={`${DOCUMENT_LABEL.data_protection} (optional)`}
            id="data_protection_document"
            file={dataProtection}
            onChange={setDataProtection}
            errors={errors}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !incorporation}>
          {loading ? <Spinner /> : <BadgeCheck className="size-4" />}
          Submit for review
        </Button>
        {error && !errors ? <FieldError>{errorMessage(error, 'Failed to submit.')}</FieldError> : null}
      </div>
    </form>
  )
}

function TextField({
  label,
  id,
  value,
  onChange,
  errors,
  type = 'text',
  placeholder,
  required = true,
}: {
  label: string
  id: FieldKey
  value: string
  onChange: (value: string) => void
  errors?: Record<string, Array<{ message?: string }>>
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        />
      </InputGroup>
      <FieldError errors={errors?.[id]} />
    </Field>
  )
}

function FileField({
  label,
  id,
  file,
  onChange,
  errors,
  required = false,
}: {
  label: string
  id: string
  file: File | null
  onChange: (file: File | null) => void
  errors?: Record<string, Array<{ message?: string }>>
  required?: boolean
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        required={required}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      {file ? <p className="text-xs text-muted-foreground">{file.name}</p> : null}
      <FieldError errors={errors?.[id]} />
    </Field>
  )
}

/** A read-only view of a submission, with its documents. */
export function SubmissionSummary({
  verification,
  open,
  title = 'Submission',
}: {
  verification: BusinessVerification
  open: (kind: BusinessVerificationDocument) => Promise<string>
  title?: string
}) {
  const country = countries.find((c) => c.iso2 === verification.country)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Submitted {formatDateTime(verification.submitted_at)}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Detail label="Legal name">{verification.legal_name}</Detail>
          <Detail label="Country">{country ? `${country.flag} ${country.name}` : verification.country}</Detail>
          <Detail label="Registration number">{verification.registration_number}</Detail>
          <Detail label="Website">
            <ExternalLink href={verification.website} />
          </Detail>
          <Detail label="Registered address">{verification.registered_address}</Detail>
          <Detail label="Data protection officer">
            {verification.dpo_name} · {verification.dpo_email}
          </Detail>
          <Detail label="Privacy policy">
            <ExternalLink href={verification.privacy_policy_url} />
          </Detail>
          <Detail label="Data protection registration">{verification.data_protection_registration ?? '—'}</Detail>
        </dl>
        <div className="flex flex-wrap gap-2">
          {verification.documents.map((kind) => (
            <DocumentButton key={kind} label={DOCUMENT_LABEL[kind]} open={() => open(kind)} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  )
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
      {href}
    </a>
  )
}

/** Opens an authenticated document in a new tab. */
function DocumentButton({ label, open }: { label: string; open: () => Promise<string> }) {
  const [loading, setLoading] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={() => {
        setLoading(true)
        void open()
          .then((url) => window.open(url, '_blank', 'noopener'))
          .finally(() => setLoading(false))
      }}
    >
      {loading ? <Spinner /> : <FileText className="size-4" />}
      {label}
    </Button>
  )
}
