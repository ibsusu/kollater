import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), basicSsl()],
  worker: {
    format: 'es',
  },
  build: {
    target: "ES2022"
  },
  server: {
    port: 5173,
    host: 'kollator.local'
  }
})
