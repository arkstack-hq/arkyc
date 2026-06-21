import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev convenience: proxy API calls to the local Arkstack API.
      // The Arkstack app listens on APP_PORT (apps/api/.env, default 3100). Use
      // 127.0.0.1 (not localhost) since the API binds IPv4; override with VITE_API_PROXY.
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
