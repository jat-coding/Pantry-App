import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { parseRecipe, fetchPage } from './api/_lib/recipe.js'

// Local-dev mirror of the Vercel serverless functions in api/. In production
// Vercel runs api/parse.js and api/recipe-proxy.js; locally `npm run dev` uses
// this middleware so the same /api/* paths work without a second tool.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      // GET /api/recipe-proxy?url=<encoded>
      server.middlewares.use('/api/recipe-proxy', async (req, res) => {
        const target = new URL(req.originalUrl, 'http://localhost').searchParams.get('url')
        if (!target) {
          res.statusCode = 400
          res.end('Missing url param')
          return
        }
        try {
          const html = await fetchPage(target)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        } catch (err) {
          res.statusCode = 502
          res.end('Fetch failed: ' + (err?.message || 'unknown error'))
        }
      })

      // POST /api/parse
      server.middlewares.use('/api/parse', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', async () => {
          try {
            const recipe = await parseRecipe(JSON.parse(raw || '{}'))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(recipe))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message || 'Parse failed' }))
          }
        })
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load every var from .env (including the un-prefixed, server-only
  // ANTHROPIC_API_KEY) and expose it to the dev middleware via process.env.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY

  return {
    plugins: [
      react(),
      devApi(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // Keep the existing hand-written public/manifest.webmanifest; the plugin
        // only generates and registers the offline service worker.
        manifest: false,
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        },
      }),
    ],
    build: {
      // Split large, rarely-changing vendor libs into their own cached chunks so
      // the app code stays small and the 500 kB chunk warning goes away.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
              if (id.includes('react')) return 'react-vendor'
            }
          },
        },
      },
    },
  }
})
