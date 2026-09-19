import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy REST calls straight through to the FastAPI backend in dev.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Proxy the WebSocket endpoint too.
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
