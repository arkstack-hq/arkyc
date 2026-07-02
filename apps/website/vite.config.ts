import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
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
    // 5173 is the dashboard; keep the marketing site on its own port.
    port: 5175,
  },
  ssgOptions: {
    // Emit each route as its own directory (`/docs/sdk/index.html`) so any static
    // host serves clean URLs without rewrite rules. `/verify` renders a client
    // shell (see VerifyRoute) and hydrates the widget on the client.
    dirStyle: 'nested',
  },
})
