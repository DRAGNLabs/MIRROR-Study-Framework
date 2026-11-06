import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The tab icon follows MODE: fish_local.png for "local", fish_development.png for
// "development", and fish_production.png for "production" or anything else.
// MODE comes from the host's environment variables (e.g. Railway, which exposes
// them during the build) or, locally, from backend/.env.
const FAVICONS = {
  local: '/fish_local.png',
  development: '/fish_development.png',
  production: '/fish_production.png',
}

function modeFavicon(viteMode) {
  const backendDir = fileURLToPath(new URL('../backend', import.meta.url))
  const appMode = (process.env.MODE ?? loadEnv(viteMode, backendDir, '').MODE ?? '').trim().toLowerCase()
  const href = FAVICONS[appMode] ?? FAVICONS.production

  return {
    name: 'mode-favicon',
    // Swaps the default icon link in index.html for this mode's icon
    transformIndexHtml(html) {
      return html.replace(/(<link rel="icon"[^>]*href=")[^"]*(")/, `$1${href}$2`)
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
