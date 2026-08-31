import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Where the real demo videos live. Outside the repo on purpose: they are large, they sit in
 * OneDrive, and copying them into the project would double hundreds of megabytes inside a
 * synced folder.
 *
 * Production will not use this. Assets belong on a CDN, which is still an open item in
 * docs/solution-design.md.
 */
const MEDIA_ROOT = process.env['SHOWROOM_MEDIA_ROOT']
  ? path.resolve(process.env['SHOWROOM_MEDIA_ROOT'])
  : path.resolve(appDir, '..', '..', 'Resources')

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m4v': 'video/mp4',
  // Several of the NiCE World sessions are .mov. Without this they were served as
  // application/octet-stream and only played because the browser sniffed the container.
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
}

/**
 * Dev-only static server for the media directory, with HTTP range support.
 *
 * Range handling is not optional here. Without it the browser cannot seek, and seeking is
 * the entire point of the chapter experience.
 */
function mediaPlugin(): Plugin {
  return {
    name: 'showroom-media',
    configureServer(server) {
      server.middlewares.use('/media', (req, res, next) => {
        const requested = decodeURIComponent((req.url ?? '').split('?')[0] ?? '').replace(/^\/+/, '')
        if (!requested) return next()

        const resolvedRoot = path.resolve(MEDIA_ROOT)
        const full = path.resolve(resolvedRoot, requested)

        // Traversal guard. The path must stay inside the media root, whatever the client sent.
        if (full !== resolvedRoot && !full.startsWith(resolvedRoot + path.sep)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }

        let stat: fs.Stats
        try {
          stat = fs.statSync(full)
        } catch {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        if (!stat.isFile()) {
          res.statusCode = 404
          res.end('Not found')
          return
        }

        const contentType = MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream'
        const total = stat.size
        const range = req.headers.range

        if (!range) {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': String(total),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
          })
          fs.createReadStream(full).pipe(res)
          return
        }

        const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
        if (!match) {
          res.writeHead(416, { 'Content-Range': `bytes */${total}` })
          res.end()
          return
        }

        const [, rawStart = '', rawEnd = ''] = match
        let start = rawStart === '' ? 0 : Number(rawStart)
        let end = rawEnd === '' ? total - 1 : Number(rawEnd)

        // A suffix range, "bytes=-500", means the last N bytes.
        if (rawStart === '' && rawEnd !== '') {
          start = Math.max(0, total - Number(rawEnd))
          end = total - 1
        }

        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
          res.writeHead(416, { 'Content-Range': `bytes */${total}` })
          res.end()
          return
        }
        end = Math.min(end, total - 1)

        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        })
        fs.createReadStream(full, { start, end }).pipe(res)
      })

      server.config.logger.info(`  ➜  media root: ${MEDIA_ROOT}`)
    },
  }
}

/**
 * Dev proxy to the Cognigy REST endpoint.
 *
 * The endpoint URL contains a URL token, which is a credential: it is all anyone needs to
 * talk to the agent and spend the LLM budget. Proxying keeps it server-side, so it never
 * appears in the client bundle or in devtools. It also sidesteps CORS, since Cognigy
 * endpoints do not send permissive CORS headers for a localhost origin.
 *
 * Returns undefined when unset, so mock mode still runs with no configuration.
 */
function cognigyProxy(endpointUrl: string | undefined): Record<string, ProxyOptions> {
  if (!endpointUrl) return {}

  let parsed: URL
  try {
    parsed = new URL(endpointUrl)
  } catch {
    console.warn('[showroom] COGNIGY_ENDPOINT_URL is not a valid URL, proxy disabled')
    return {}
  }

  return {
    '/api/cognigy': {
      target: parsed.origin,
      changeOrigin: true,
      secure: true,
      rewrite: () => parsed.pathname,
    },
  }
}

export default defineConfig(({ mode }) => {
  // Third arg '' loads every var, not just VITE_-prefixed ones. This runs in Node, so the
  // token is never exposed to the browser.
  const env = loadEnv(mode, appDir, '')

  return {
    // GitHub Pages serves from /<repo>/, so asset URLs need that prefix. Set VITE_BASE in
    // the Pages workflow. Defaults to '/' for local dev and any root-hosted deployment.
    base: env['VITE_BASE'] || '/',
    plugins: [react(), mediaPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // The catalog is the project's source of truth and lives outside the app on purpose.
        // In mock mode it is imported client-side because there is no backend. In production
        // it stays server-side, behind find_demo.
        '@catalog': fileURLToPath(new URL('../catalog', import.meta.url)),
      },
    },
    server: {
      port: 5180,
      // Permits importing ../catalog during dev.
      fs: { allow: ['..'] },
      proxy: cognigyProxy(env['COGNIGY_ENDPOINT_URL']),
    },
  }
})
