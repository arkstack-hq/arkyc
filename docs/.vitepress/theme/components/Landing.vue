<script setup lang="ts">
import { withBase } from 'vitepress'

// NOTE: update REPO to the canonical GitHub URL once published.
const REPO = 'https://github.com/arcstack/arkyc'

const features = [
  {
    title: 'Multi-tenant from day one',
    body: 'Every table, query, storage path, and route is tenant- and project-scoped. Tenants → projects → sessions, with per-tenant RBAC.',
  },
  {
    title: 'Driver-based providers',
    body: 'OCR, liveness, and face match each ship a deterministic mock driver plus an external HTTP driver — swap real providers by config alone.',
  },
  {
    title: 'Async verification pipeline',
    body: 'A Postgres-backed job queue runs OCR and biometric work off the request path, driving each session to an automated decision.',
  },
  {
    title: 'Human-in-the-loop reviews',
    body: 'A review queue with approve / reject / retry / assign / note, plus a full audit trail of every tenant-scoped action.',
  },
  {
    title: 'Signed webhooks',
    body: 'HMAC-SHA256 signed delivery per project, with retries and a deliveries log. Verify in one call with @arkyc/sdk.',
  },
  {
    title: 'SDK + embeddable widget',
    body: 'A typed server SDK creates sessions; the framework-agnostic widget runs the capture flow in overlay, inline, or hosted mode.',
  },
]

const quickstart = `import { Arkyc } from '@arkyc/sdk'

const arkyc = new Arkyc({ secretKey: process.env.ARKYC_SECRET_KEY })

// Create a verification session, hand the client token to the widget.
const session = await arkyc.sessions.create({
  projectId: 'prj_123',
  userReference: 'user_456',
})

// Later — verify a signed webhook delivery in one call.
const event = arkyc.webhooks.verify(rawBody, signature, secret)`
</script>

<template>
  <div class="landing">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <p class="eyebrow"><span class="dot" /> Open source · MIT licensed</p>
        <h1 class="title">Identity verification<br />you can self-host.</h1>
        <p class="tagline">
          Multi-tenant document &amp; biometric verification — capture, OCR, liveness, face match,
          decisioning, reviews, webhooks, a typed SDK and an embeddable widget. Run the whole stack
          yourself.
        </p>
        <div class="actions">
          <a class="btn btn-brand" :href="withBase('/guide/getting-started')">Get started</a>
          <a class="btn btn-alt" :href="withBase('/api/')">API reference</a>
          <a class="btn btn-ghost" :href="REPO" target="_blank" rel="noreferrer">View on GitHub →</a>
        </div>
        <code class="install">$ pnpm add @arkyc/sdk</code>
      </div>

      <div class="code-card" aria-hidden="true">
        <div class="code-chrome"><span /><span /><span /></div>
        <pre><code>{{ quickstart }}</code></pre>
      </div>
    </section>

    <!-- Features -->
    <section class="features">
      <h2 class="section-title">Everything the verification path needs</h2>
      <div class="grid">
        <div v-for="f in features" :key="f.title" class="feature">
          <h3>{{ f.title }}</h3>
          <p>{{ f.body }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <h2>Ship verification without the vendor lock-in.</h2>
      <p>Read the architecture, wire up the SDK, and embed the widget in an afternoon.</p>
      <div class="actions">
        <a class="btn btn-brand" :href="withBase('/guide/getting-started')">Get started</a>
        <a class="btn btn-alt" :href="withBase('/guide/architecture')">How it works</a>
      </div>
    </section>

    <footer class="foot">
      <p>Released under the MIT License.</p>
      <p class="muted">Built on Arkstack + Arkormˣ.</p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  margin: 0 auto;
  padding: 0 24px;
  max-width: 1152px;
}

/* Hero */
.hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  padding: 64px 0 32px;
}
@media (min-width: 960px) {
  .hero {
    grid-template-columns: 1.05fr 0.95fr;
    align-items: center;
    padding: 88px 0 48px;
  }
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: var(--vp-c-brand-1);
}
.title {
  margin: 0;
  font-size: 44px;
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.02em;
}
@media (min-width: 960px) {
  .title {
    font-size: 56px;
  }
}
.tagline {
  margin: 20px 0 0;
  max-width: 36em;
  font-size: 17px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}
.btn {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  border: 1px solid transparent;
}
.btn-brand {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.btn-brand:hover {
  background: var(--vp-c-brand-3);
}
.btn-alt {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-divider);
  color: var(--vp-c-text-1);
}
.btn-alt:hover {
  border-color: var(--vp-c-brand-1);
}
.btn-ghost {
  color: var(--vp-c-text-2);
}
.btn-ghost:hover {
  color: var(--vp-c-brand-1);
}
.install {
  display: inline-block;
  margin-top: 22px;
  padding: 8px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  color: var(--vp-c-text-2);
}

/* Code card */
.code-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.code-chrome {
  display: flex;
  gap: 6px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.code-chrome span {
  width: 11px;
  height: 11px;
  border-radius: 9999px;
  background: var(--vp-c-divider);
}
.code-card pre {
  margin: 0;
  padding: 18px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.7;
}
.code-card code {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
}

/* Features */
.features {
  padding: 56px 0;
  border-top: 1px solid var(--vp-c-divider);
}
.section-title {
  margin: 0 0 32px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}
@media (min-width: 640px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (min-width: 960px) {
  .grid {
    grid-template-columns: 1fr 1fr 1fr;
  }
}
.feature {
  padding: 22px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
}
.feature h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.feature p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

/* CTA */
.cta {
  padding: 64px 0;
  text-align: center;
  border-top: 1px solid var(--vp-c-divider);
}
.cta h2 {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.cta p {
  margin: 12px 0 0;
  color: var(--vp-c-text-2);
}
.cta .actions {
  justify-content: center;
}

/* Footer */
.foot {
  padding: 32px 0 48px;
  border-top: 1px solid var(--vp-c-divider);
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.foot p {
  margin: 2px 0;
}
.foot .muted {
  color: var(--vp-c-text-3);
}
</style>
