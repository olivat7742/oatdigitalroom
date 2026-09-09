#!/usr/bin/env node
/**
 * Probes the remote media host for every video in the catalog and writes
 * catalog/remote-media.json, which tools/build-catalog.mjs then reads.
 *
 *   node tools/probe-remote-media.mjs
 *   node tools/probe-remote-media.mjs --base https://other.host/
 *
 * WHY A COMMITTED MANIFEST RATHER THAN PROBING DURING THE BUILD
 *
 * build-catalog.mjs must stay deterministic and offline. If it probed the network, the
 * generated catalog would depend on which videos happened to be uploaded at the moment
 * someone ran a build, two people would produce different catalogs from the same source, and
 * a build on a machine outside the lab network would silently drop every remote URL. So the
 * probe is a separate, explicit step and its result is a reviewable file: the diff on
 * remote-media.json is the record of what changed on the host.
 *
 * Re-run this after uploading more videos, then re-run build-catalog.mjs.
 *
 * WHAT "AVAILABLE" MEANS HERE, AND WHAT IT DOES NOT
 *
 * Available means the host answered 200 to a HEAD for that exact path, from THIS machine.
 * It does not mean every visitor can play it. The host presents a certificate issued by NiCE's
 * internal PKI (Nice Systems RootCA), not a public CA, so the TLS handshake only succeeds on a
 * device carrying the NiCE corporate root. On any other device the request fails with a
 * certificate error. That is why VideoAsset.tsx treats a media error as a fall back to
 * simulated playback rather than trusting this manifest: presence on the host and playability
 * in the visitor's browser are two different questions, and only the browser can answer the
 * second one.
 *
 * Certificate validation is NOT disabled here. If the handshake fails, that is a real finding
 * about what visitors will experience and it belongs in the output, not hidden behind a flag.
 *
 * No dependencies, so it runs on a machine with nothing installed.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const catalogPath = path.join(repoRoot, 'catalog', 'demo-catalog.json')
const manifestPath = path.join(repoRoot, 'catalog', 'remote-media.json')

const baseArgIndex = process.argv.indexOf('--base')
const DEFAULT_BASE = 'https://stt.nicelab71.com/'
const BASE =
  baseArgIndex !== -1 && process.argv[baseArgIndex + 1] ? process.argv[baseArgIndex + 1] : DEFAULT_BASE

if (!BASE.startsWith('https://')) {
  // Not a style preference. The room is served over HTTPS on GitHub Pages, and a browser
  // upgrades or blocks http:// media on an https:// page, so an http base produces a player
  // that fails for everyone rather than a player that works for some.
  console.error(`Refusing base "${BASE}": it must be https://, or every visitor gets mixed-content blocking.`)
  process.exit(1)
}
if (!BASE.endsWith('/')) {
  console.error(`Refusing base "${BASE}": it must end with a slash, so joining a path cannot eat a segment.`)
  process.exit(1)
}

/**
 * The catalog stores a local path, `/media/a%20b/c.mp4`. Recovering the on-disk relative path
 * means decoding each SEGMENT, not the whole string: decoding the whole thing would turn an
 * encoded %2F inside a filename into a path separator.
 */
function relPathFromMediaUrl(url) {
  return url
    .replace(/^\/media\//, '')
    .split('/')
    .map(decodeURIComponent)
    .join('/')
}

/** Mirror of mediaUrl() in build-catalog.mjs: encode each segment, leave the slashes alone. */
function encodePath(relPath) {
  return relPath.split('/').map(encodeURIComponent).join('/')
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const videos = catalog.assets
  .filter((asset) => asset.type === 'video' && asset.source?.provider === 'local' && asset.source.url)
  .map((asset) => ({ id: asset.id, relPath: relPathFromMediaUrl(asset.source.url) }))

if (videos.length === 0) {
  console.error('No local video assets in the catalog. Run tools/build-catalog.mjs first.')
  process.exit(1)
}

/**
 * HEAD one candidate. Returns the status, or a transport error string.
 *
 * HEAD rather than GET because these files run to 269 MB and only presence is in question.
 * The host answered HEAD with a full Content-Length and Accept-Ranges when this was written,
 * so nothing is lost by not fetching a byte.
 */
async function head(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    return { status: response.status, contentType: response.headers.get('content-type') ?? null }
  } catch (error) {
    return { status: 0, error: error?.cause?.code ?? error?.code ?? String(error?.message ?? error) }
  }
}

/**
 * Files arrived on the host flat, by basename, even the ones filed into per-industry folders
 * locally. So a nested asset is tried at its full relative path FIRST, since that is the
 * unambiguous address, and only then at its bare basename. Recording which form answered
 * matters: two different industry folders could hold the same basename, and if that ever
 * happens the flat form is no longer safe to use.
 */
function candidatesFor(relPath) {
  const basename = relPath.split('/').pop()
  return relPath === basename ? [relPath] : [relPath, basename]
}

const available = {}
const absent = []
const errors = []
const flatFallbacks = []

for (const { id, relPath } of videos) {
  let resolved = null
  let lastStatus = null

  for (const candidate of candidatesFor(relPath)) {
    const result = await head(`${BASE}${encodePath(candidate)}`)
    if (result.error) {
      errors.push(`${id}: ${result.error}`)
      lastStatus = result.error
      continue
    }
    lastStatus = result.status
    if (result.status === 200) {
      resolved = { candidate, contentType: result.contentType }
      break
    }
  }

  if (!resolved) {
    absent.push({ id, relPath, lastStatus })
    continue
  }

  available[id] = { path: resolved.candidate, contentType: resolved.contentType }
  if (resolved.candidate !== relPath) flatFallbacks.push(`${id}: found as "${resolved.candidate}", not "${relPath}"`)
}

// A basename collision would make the flat form ambiguous, so it is checked rather than assumed.
const byFlatPath = new Map()
for (const [id, entry] of Object.entries(available)) {
  const existing = byFlatPath.get(entry.path)
  if (existing) errors.push(`Two assets resolve to the same remote path "${entry.path}": ${existing} and ${id}.`)
  byFlatPath.set(entry.path, id)
}

const manifest = {
  notes:
    'GENERATED by tools/probe-remote-media.mjs. Records which catalog videos the remote host actually serves, so build-catalog.mjs can emit a remote URL for those and leave the rest without one. Re-run the probe after uploading videos, then re-run the build. Do not hand-edit.',
  playabilityCaveat:
    "Listed here means the host answered 200 from the machine that ran the probe. It does NOT mean every visitor can play it: the host's certificate is issued by NiCE's internal PKI rather than a public CA, so the TLS handshake only succeeds on a device carrying the NiCE corporate root. Elsewhere the request fails with a certificate error and VideoAsset.tsx falls back to simulated playback. Serving these from a publicly-trusted certificate is what would make them work for everyone.",
  base: BASE,
  probedOn: new Date().toISOString().slice(0, 10),
  availableCount: Object.keys(available).length,
  totalVideos: videos.length,
  available,
  absent: absent.map((entry) => entry.id).sort(),
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`Probed ${videos.length} catalog videos against ${BASE}`)
console.log(`  available: ${Object.keys(available).length}`)
console.log(`  absent:    ${absent.length}`)
if (flatFallbacks.length) {
  console.log('\nResolved at a different path than the local one:')
  for (const line of flatFallbacks) console.log(`  ${line}`)
}
if (errors.length) {
  console.log('\nTransport or collision problems:')
  for (const line of [...new Set(errors)]) console.log(`  ${line}`)
}
console.log(`\nWrote ${path.relative(repoRoot, manifestPath)}`)
console.log('Next: node tools/build-catalog.mjs')
