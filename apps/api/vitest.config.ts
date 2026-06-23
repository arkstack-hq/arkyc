import { URL, fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
        target: 'es2021',
      },
    }) as never,
  ],
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
    environment: 'node',
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // Load .env (APP_KEY for stable JWT signing, DATABASE_URL, etc.) before tests.
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
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
    },
  },
})
