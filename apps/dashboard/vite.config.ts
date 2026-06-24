import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev convenience: proxy API calls to the local Arkstack API.
      // The Arkstack app listens on APP_PORT (apps/api/.env, default 3100).
      // Use `localhost` (not 127.0.0.1): Arkstack binds IPv6 (::1) here, and
      // localhost lets Node try both IPv6/IPv4. Override with VITE_API_PROXY.
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:3100',
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
