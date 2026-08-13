import { URL, fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true
    }
  },
  resolve: {
    alias: {
      '@': resolvePath('./src'),
      src: resolvePath('./src'),
      '@app': resolvePath('./src/app'),
      '@core': resolvePath('./src/core'),
      '@controllers': resolvePath('./src/app/http/controllers'),
      '@models': resolvePath('./src/app/models'),
    },
  },
  test: {
    passWithNoTests: true,
    // The suite shares one Postgres + app process, so a couple of password/2FA
    // login tests can intermittently lose a race with a fire-and-forget mail/DB
    // write when the whole suite runs together (they pass in isolation). A small
    // bounded retry keeps CI deterministic without masking real failures.
    retry: 2,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // Load .env (APP_KEY for stable JWT signing, DATABASE_URL, etc.) before tests.
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      // Not local/development — keeps the OCR debug log (storage/logs/ocr.log)
      // off during tests so the suite doesn't write a line per session.
      APP_ENV: 'testing',
      VERBOSITY: '0',
      // Use the file mail transport in tests — no SMTP socket. The default
      // `smtp` transport fires un-awaited background connects (via fire-and-forget
      // `sendMail`) to a non-existent server, which races with subsequent DB
      // reads in the shared test process (e.g. login reading a stale password
      // right after a reset).
      MAIL_TRANSPORT: 'file',
      // Record realtime broadcasts in-memory (no live pusher/firebase) so tests
      // can assert what was published. `memory` is an env-only hard override.
      REALTIME_TRANSPORT: 'memory',
      // Pin the deterministic mock provider drivers so the suite never depends on
      // a developer's local .env (e.g. OCR_DRIVER=tesseract, which would run the
      // real engine on placeholder images). Set before dotenv, which won't override.
      OCR_DRIVER: 'mock',
      LIVENESS_DRIVER: 'mock',
      FACE_MATCH_DRIVER: 'mock',
      ADDRESS_DRIVER: 'mock',
    },
  },
})
