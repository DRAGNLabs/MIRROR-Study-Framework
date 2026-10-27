import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The tab icon follows MODE: the DRAGN logo when MODE=production, Vite's default
// otherwise. MODE comes from the host's environment variables (e.g. Railway) or,
// locally, from backend/.env.

function modeFavicon(viteMode) {
  const backendDir = fileURLToPath(new URL('../backend', import.meta.url))
  const appMode = process.env.MODE ?? loadEnv(viteMode, backendDir, '').MODE
  const isProduction = appMode === 'production'

  return {
    name: 'mode-favicon',
    transformIndexHtml() {
      return [{
        tag: 'link',
        attrs: isProduction
          ? { rel: 'icon', type: 'image/png', href: '/dragn-logo.png' }
          : { rel: 'icon', type: 'image/svg+xml', href: '/fish.png' },
        injectTo: 'head',
      }]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), modeFavicon(mode)],
  // server: {
  //   host: '0.0.0.0',
  //   proxy: {
  //     '/api': 'http://localhost:3001',
  //     '/socket.io': {
  //       target: 'http://localhost:3001',
  //       ws: true
  //     }
  //   }
  // }
}))
