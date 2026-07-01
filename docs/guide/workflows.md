# Workflows

A **workflow** is an organization-scoped, named pipeline that decides which
verification stages run, in what order, and how the optional stages behave. When
you create a session you may pass a `workflow_id`; the workflow's config is
**snapshotted onto the session at creation**, so editing (or deleting) a workflow
never changes a verification that's already in flight.

Sessions created without a `workflow_id` use the **default pipeline**.

## Stages

| Stage      | Key          | In default pipeline | Notes                                                     |
| ---------- | ------------ | ------------------- | --------------------------------------------------------- |
| Document   | `document`   | ✅                  | Capture + OCR + portrait extraction.                      |
| Liveness   | `liveness`   | ✅                  | Selfie / passive (or active) liveness.                    |
| Face match | `face_match` | ✅                  | Document portrait vs. selfie.                             |
| Address    | `address`    | ⛔ (opt-in)         | Residential-address verification (custom workflows only). |

Each stage is **toggleable** and **ordered**. A workflow must keep at least one
stage enabled. The `address` stage never appears in the default pipeline; it's
available only on a custom workflow you build in the dashboard.

> Disabling `document` (or enabling `skip_ocr`) removes the document portrait, so
> `face_match` has nothing to match against and is treated as passed-through.

## Options

| Option     | Type      | Effect                                                                                        |
| ---------- | --------- | --------------------------------------------------------------------------------------------- |
| `skip_ocr` | `boolean` | Capture the document image but don't extract fields (data-capture-only). Disables face match. |

## Address stage

The address stage corroborates the user's **claimed residential address** using
one or more **methods**. It's configured per-workflow.

| Field                    | Type                                                          | Default              | Meaning                                                      |
| ------------------------ | ------------------------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| `methods`                | `('geocode_lookup' \| 'device_location' \| 'poa_document')[]` | `['geocode_lookup']` | Which checks run (at least one required).                    |
| `on_fail`                | `'review' \| 'reject'`                                        | `'review'`           | What a **failed** result does.                               |
| `auto_approve_threshold` | `number` (0 to 1)                                             | project default      | Minimum confidence to auto-verify; below it ⇒ manual review. |

### Methods

- **`geocode_lookup`**: forward-geocodes the typed address (openrouteservice)
  and confirms the resolved country matches what the user entered.
- **`device_location`**: reverse-geocodes the user's captured GPS coordinates
  (Nominatim / OpenStreetMap) and confirms the country. The widget asks for
  browser location permission; the resolved place (Nominatim `display_name`) is
  surfaced to reviewers.
- **`poa_document`**: collects a proof-of-address image (utility bill, bank
  statement). Automated extraction isn't wired, so a captured proof routes to
  **manual review** for a human to read.

See [Provider drivers → Address](./providers#address) for the `mock` / `live`
drivers and the geocoder env (`ADDRESS_ORS_API_KEY`, …).

### How the address result is gated

Address is **never a silent auto-reject**. The [decision engine](./architecture#decision-engine)
applies, in order:

1. A **failed** address with `on_fail: 'reject'` ⇒ `rejected`
   (`ADDRESS_VERIFICATION_FAILED`).
2. A **failed** address with `on_fail: 'review'` ⇒ `requires_review`
   (`ADDRESS_VERIFICATION_FAILED`).
3. A **passed** address scoring below `auto_approve_threshold` (or the project's
   `addressThreshold` when unset) ⇒ `requires_review` (`ADDRESS_LOW_CONFIDENCE`).
4. Otherwise the address clears and the session can auto-approve.

The `auto_approve_threshold` is the straight-through-processing bar for the
address stage: raise it to send more borderline addresses to a reviewer, lower it
to auto-verify more aggressively. Leave it blank to inherit the project default.

## Editing safety

Because the workflow config is copied onto each session at creation, you can edit
methods, reorder stages, or change thresholds at any time without affecting
verifications that are already running; only **new** sessions pick up the change.
