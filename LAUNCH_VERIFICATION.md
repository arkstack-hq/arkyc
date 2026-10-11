# Launch verification

Checks that need deployed infrastructure, real devices, provider accounts or outside parties, so they cannot run in CI. Tick each one when it has been confirmed against a real environment.

## Realtime and notifications

- [ ] **Pusher Channels:** with `REALTIME_TRANSPORT=pusher` and real `PUSHER_*` credentials, the dashboard review queue and session detail update live when a session changes status, and the notification bell updates when a review is assigned.
- [ ] **Soketi (docker-compose):** with `REALTIME_TRANSPORT=pusher`, `PUSHER_HOST=soketi` and `PUSHER_PUBLIC_HOST=localhost`, the same live updates arrive in a browser on the host.
- [ ] **Firebase Realtime Database:** with `REALTIME_TRANSPORT=firebase-database`, the security rules from the Arkstack notifications guide deployed, and `FIREBASE_*` set, the dashboard and widget receive live updates and cannot read channels they were not granted.
- [ ] **Widget, plain script embed:** a page loading only `arkyc-widget.iife.global.js` loads `pusher-js` from jsDelivr and receives session transitions without polling.
- [ ] **Browser push:** with `REALTIME_PUSH=firebase`, the VAPID key set and the service account at `storage/app/firebase-adminsdk.json`, enabling push on `/account/notifications` registers the browser, and an assigned review shows a system notification while the dashboard is closed; clicking it opens the session.
- [ ] **Dead tokens:** after the browser's push subscription is revoked, the next push removes its token from `user_push_tokens`.
