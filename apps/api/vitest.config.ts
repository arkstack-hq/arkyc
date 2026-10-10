import { URL, fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
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
    // bounded retry keeps CI deterministic without masking real failures.
    retry: 2,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      APP_ENV: 'testing',
      VERBOSITY: '0',
      MAIL_TRANSPORT: 'file',
      REALTIME_TRANSPORT: 'memory',
      OCR_DRIVER: 'mock',
      LIVENESS_DRIVER: 'mock',
      FACE_MATCH_DRIVER: 'mock',
      ADDRESS_DRIVER: 'mock',
      FILESYSTEM_DISK: 'local',
    },
  },
})
