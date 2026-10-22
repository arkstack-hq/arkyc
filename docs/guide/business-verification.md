# Business verification

Arkyc processes identity documents, selfies and the personal data extracted from
them. Every organization is treated as a business and has to prove it may handle
that data before it verifies identities in **production**. Development and
staging projects stay open the whole time, so you can build and test while the
review happens.

## What is gated

Until an organization is verified:

- New projects start in `development`. Creating a `production` project returns
  `422` on `environment`.
- Starting a session on an existing production project returns `403` with the
  error key `organization_unverified`.

Nothing else changes: development and staging sessions, the dashboard, API keys
and webhooks all work as usual.

## Submitting

An owner or admin (anyone with `organizations.update`) submits from
**Settings → Business verification** in the dashboard:

| Field                             | Notes                                          |
| --------------------------------- | ---------------------------------------------- |
| Legal name                        | As registered with the company registry.       |
| Country of registration           | ISO 3166-1 alpha-2.                            |
| Registration number               | The company or business registration number.   |
| Registered address                |                                                |
| Website                           |                                                |
| Data protection officer and email | Whoever answers for personal data.             |
| Privacy policy URL                |                                                |
| Data protection registration      | Optional; where your regulator issues one.     |
| Certificate of incorporation      | Required upload: PDF, PNG or JPG, up to 10 MB. |
| Data protection certificate       | Optional upload.                               |

The organization is then **under review**. It can't submit again until a platform
admin decides.

## Review

Platform admins review submissions under **Admin → Business verification**,
check the registration against the registry and the documents against the
details, and approve or reject. A rejection carries a note saying what to fix;
the organization corrects the form (prefilled from the last submission) and
submits again. Members who can update the organization's settings are notified
either way.

Admins can also mark an organization verified or unverified directly from its
admin page, for example for an organization verified outside Arkyc.

## Turning the gate off

The gate is on by default. Platform admins can switch it off under **Admin →
Settings → Compliance** (`compliance.business_verification_required`), for
example on a self-hosted instance used by a single business. When it is off,
every organization can run production projects, and verification is optional.

When upgrading an instance that already has production projects, decide before
deploying: verify the existing organizations (or mark them verified), or switch
the gate off first, otherwise their live sessions are refused.

## API

See [Dashboard API → Organizations](/api/dashboard#organizations) and
[Admin → Business verification](/api/dashboard#admin-business-verification).
