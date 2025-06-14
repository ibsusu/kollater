import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

function crossOriginIsolationMiddleware(_: any, response: { setHeader: (arg0: string, arg1: string) => void; }, next: () => void) {
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}

const crossOriginIsolation = {
  name: 'cross-origin-isolation',
  configureServer: (server: { middlewares: { use: (arg0: (_: any, response: { setHeader: (arg0: string, arg1: string) => void; }, next: () => void) => void) => void; }; }) => { server.middlewares.use(crossOriginIsolationMiddleware); },
  configurePreviewServer: (server: { middlewares: { use: (arg0: (_: any, response: { setHeader: (arg0: string, arg1: string) => void; }, next: () => void) => void) => void; }; }) => { server.middlewares.use(crossOriginIsolationMiddleware); },
};


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), crossOriginIsolation],
  worker: {
    format: 'es',
  },
  build: {
    target: "esnext"
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    },
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
      cert: '../certs/kollator.local+4.pem',
      key: '../certs/kollator.local+4-key.pem'
    }
  }
})
