import { defineConfig } from 'vitest/config'
import { rawCssPlugin } from './raw-css.mjs'

export default defineConfig({
  plugins: [rawCssPlugin()],
  test: {
    passWithNoTests: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
})
