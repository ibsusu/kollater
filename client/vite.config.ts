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
  }
})
