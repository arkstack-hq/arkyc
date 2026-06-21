# @arkyc/widget

The embeddable [Arkyc](../../README.md) identity-verification widget — a polished,
mobile-friendly, **framework-agnostic** flow that walks a user through document
capture, liveness, and face match. It talks only to the **Client/Widget API**
with a short-lived client token (minted by your backend via `@arkyc/sdk`).

The flow: **Welcome → Document Selection → Front Capture → Back Capture → OCR
Processing → Selfie Capture → Passive Liveness → Face Match → Processing →
Result**. `back_capture` is skipped automatically for single-sided documents
(passports).

## Install

```bash
npm install @arkyc/widget
```

## Modes

```ts
import { ArkycWidget } from '@arkyc/widget'

// Overlay modal (full-screen, dismissable):
ArkycWidget.open({
  token: clientToken,
  branding: { primary_color: '#4f46e5', theme: 'light' },
  onComplete: (r) => console.log(r.status, r.decision),
  onError: (e) => console.error(e),
  onClose: () => {},
})

// Inline (mounted into a container element):
ArkycWidget.mount({ token: clientToken, container: '#verify' })
```

`token` comes from `arkyc.sessions.create()` on your server. `branding` is
usually sourced from your project's configuration (colors, logo, border radius,
light/dark theme).

## Hosted / standalone

The widget also ships a minified browser global for plain `<script>` embedding —
this is what the hosted widget page (and `@arkyc/sdk/browser`'s `ArkycWidget.open`
iframe launcher) loads:

```html
<script src="https://unpkg.com/@arkyc/widget/dist/arkyc-widget.iife.global.js"></script>
<script>
  // Reads ?token= (and optional ?baseUrl=) from the URL and posts
  // `arkyc:complete` / `arkyc:error` / `arkyc:close` to the parent window.
  Arkyc.ArkycWidget.hosted()
</script>
```

Build the standalone bundle with `pnpm --filter @arkyc/widget build:standalone`
(the ESM + `.d.ts` build comes from the workspace `tsdown`).

## Camera & capture

Capture screens use `getUserMedia` for a live preview and grab a JPEG frame via
an offscreen canvas, falling back to a file input when the camera is unavailable
or permission is denied. Overlay iframes are launched with
`allow="camera; microphone"`.

## Messaging contract

In hosted/iframe mode the widget posts these messages to `window.parent`, which
`@arkyc/sdk/browser` listens for:

| Message           | Payload                          |
| ----------------- | -------------------------------- |
| `arkyc:complete`  | `{ status, decision }`           |
| `arkyc:error`     | `{ message, name }`              |
| `arkyc:close`     | —                                |

`onComplete` / `onError` fire when the user acknowledges the result screen, so
the user always sees the outcome before the widget tears down.

## Programmatic API

`ArkycClient` (the Client API wrapper), `resolveTheme`, and the pure flow
helpers (`nextStep`, `isTerminal`, `statusToDecision`, `STEP_ORDER`) are exported
for custom integrations and testing.
