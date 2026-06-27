# Widget

`@arkyc/widget` is the framework-agnostic verification flow. **You bundle it into
your own frontend** and drive it with a short-lived client token your backend
mints with the [SDK](/integrations/sdk#sessions) — the widget talks directly to
the [Client API](/api/client) with the `X-Client-Token` header and never sees
your secret key.

Two ways to put the widget in front of users:

- **Embed `@arkyc/widget`** (this page) — bundle the flow into your frontend for
  full control of layout (overlay, inline, fullscreen) and theming.
- **[Hosted launcher](/integrations/sdk#browser-launcher)** (`@arkyc/sdk/browser`) —
  load the Arkyc-hosted widget in an overlay iframe; your frontend bundles almost
  nothing and only needs the token.

## Install

```bash
pnpm add @arkyc/widget
```

A standalone build is also published at `@arkyc/widget/standalone` (a minified
IIFE that exposes a global `Arkyc`) for use via a `<script>` tag.

## Modes

```ts
import { ArkycWidget } from '@arkyc/widget'

// Overlay (full-screen modal)
ArkycWidget.open({ token, onComplete })

// Inline (mounted into a container)
ArkycWidget.mount({ token, container: '#verify', onComplete })

// Hosted page (reads ?token= and posts results to the parent window)
ArkycWidget.hosted()
```

## Options

| Option       | Type                                 | Notes                                                                                                                                                                        |
| ------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token`      | `string` (required)                  | The client token from `arkyc.sessions.create`.                                                                                                                               |
| `baseUrl`    | `string`                             | Client API base (include `/api`). Omitted or relative (e.g. `/api`) → current origin, no CORS; an absolute URL (`https://api.example.com/api`) is used as-is and needs CORS. |
| `branding`   | `ProjectBranding`                    | Colors, logo, radius, theme. Defaults from project config.                                                                                                                   |
| `onComplete` | `(result) => void`                   | `result` is `{ status, decision }`.                                                                                                                                          |
| `onError`    | `(error) => void`                    |                                                                                                                                                                              |
| `onClose`    | `() => void`                         |                                                                                                                                                                              |
| `container`  | `string \| HTMLElement` (mount only) | Where to render inline.                                                                                                                                                      |

## Example

```ts
const res = await fetch('/verify/start', { method: 'POST' })
const { clientToken } = await res.json()

ArkycWidget.mount({
  token: clientToken,
  container: '#verify',
  baseUrl: '/api', // same-origin proxy to the Arkyc API
  onComplete: ({ status, decision }) => {
    console.log('done', status, decision)
  },
  onError: (e) => console.error(e),
})
```

## The flow

Welcome → document selection → front capture → back capture → OCR → selfie →
passive liveness → face match → processing → result. Back capture is skipped for
single-sided documents (e.g. passports); the final `processing` screen polls the
session to a terminal status.

The exact stages (and their order) follow the session's
[workflow](/guide/workflows) — a custom workflow can also insert an **address**
step, where the user enters their residential address and, depending on the
configured methods, uploads a proof-of-address image or shares their device
location.

Capture uses `getUserMedia` + a canvas frame grab, with a file-input fallback.
The widget talks **only** to the Client API with the `X-Client-Token` header — it
never sees your secret key.

### Device location (address stage)

The `device_location` address method calls `navigator.geolocation`, which needs a
**secure context** and, in the hosted/overlay iframe, the `geolocation`
permission. The SDK launcher sets `allow="camera; microphone; geolocation"` on the
iframe automatically. The user opts in with a checkbox before any prompt fires;
Continue stays disabled until a location fix is captured.

## Not bundling the widget?

If you'd rather not bundle the flow into your frontend, the
[SDK browser launcher](/integrations/sdk#browser-launcher) (`@arkyc/sdk/browser`)
loads the Arkyc-hosted widget in an overlay iframe and relays `arkyc:complete` /
`arkyc:error` / `arkyc:close` back to your page — the browser only needs the
token. Point it at a custom verify-page origin with `widgetUrl` if you host that
page yourself.
