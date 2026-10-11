# Launch verification

Checks that need deployed infrastructure, real devices, provider accounts or outside parties, so they cannot run in CI. Tick each one when it has been confirmed against a real environment.

## Realtime and notifications

- [ ] **Pusher Channels:** with `REALTIME_TRANSPORT=pusher` and real `PUSHER_*` credentials, the dashboard review queue and session detail update live when a session changes status, and the notification bell updates when a review is assigned.
- [ ] **Soketi (docker-compose):** with `REALTIME_TRANSPORT=pusher`, `PUSHER_HOST=soketi` and `PUSHER_PUBLIC_HOST=localhost`, the same live updates arrive in a browser on the host.
- [ ] **Firebase Realtime Database:** with `REALTIME_TRANSPORT=firebase-database`, the security rules from the Arkstack notifications guide deployed, and `FIREBASE_*` set, the dashboard and widget receive live updates and cannot read channels they were not granted.
- [ ] **Widget, plain script embed:** a page loading only `arkyc-widget.iife.global.js` loads `pusher-js` from jsDelivr and receives session transitions without polling.
- [ ] **Browser push:** with `REALTIME_PUSH=firebase`, the VAPID key set and the service account at `storage/app/firebase-adminsdk.json`, enabling push on `/account/notifications` registers the browser, and an assigned review shows a system notification while the dashboard is closed; clicking it opens the session.
- [ ] **Dead tokens:** after the browser's push subscription is revoked, the next push removes its token from `user_push_tokens`.

## Fraud signals and screening

- [ ] **OpenSanctions hosted API:** with `SCREENING_DRIVER=opensanctions` and a production `SCREENING_API_KEY` (and a commercial data licence for hosted Arkyc), a session whose extracted name is on a sanctions list lands in review with `SANCTIONS_MATCH`, the hit shows on the session page, and the webhook carries it in `checks.screening`.
- [ ] **Self-hosted yente:** with `SCREENING_ENDPOINT` pointing at a yente instance and no API key, the same sanctions match is found.
- [ ] **Ongoing monitoring:** with a monitored workflow and the scheduler or queue sweep running, a re-screen after a list update raises the new hit, notifies reviewers and sends `verification.screening_alert`.
- [ ] **MaxMind:** with GeoLite2 Country and ASN databases mounted, a session claimed from a cloud VM raises `high_risk_network` (hosting), and a residential IP in the document's country raises nothing.
- [ ] **Client IP behind the proxy:** on the deployed platform with `TRUST_PROXY` set, the claim records the real client IP rather than the load balancer's.
- [ ] **pgvector in production:** the production database has the `vector` extension and `face_embeddings` exists after `ark migrate`.
- [ ] **Local biometrics on real captures:** with `FACE_MATCH_DRIVER=local` and `LIVENESS_DRIVER=local`, real phone captures (document plus selfie) of the same person are approved, a different person is rejected, and a selfie of a printed photo or a screen is flagged by liveness.
- [ ] **Local biometrics accuracy:** `ark biometrics:benchmark` over a public face verification set (for example LFW pairs) and an anti-spoofing set, with the results recorded in the providers guide next to the `external` drivers' results.
- [ ] **Worker footprint:** the API and worker images install `onnxruntime-node` and `sharp`, and `ark biometrics:setup` runs at build or boot.
