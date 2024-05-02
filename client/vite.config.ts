import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  worker: {
    format: 'es',
  },
  build: {
    target: "ES2022"
  },
  define: {
    global: "self",
  },
  resolve: {
    alias: {
      "readable-stream": "vite-compatible-readable-stream"
    },
  },
  server: {
    port: 5173,
    host: 'kollator.local',
    https: {
      cert: '../certs/_wildcard.kollator.local+3.pem',
      key: '../certs/_wildcard.kollator.local+3-key.pem'
    }
  }
})
