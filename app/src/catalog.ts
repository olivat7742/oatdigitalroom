/**
 * Loads the real demo catalog.
 *
 * In mock mode this is imported client-side because there is no backend. In production the
 * catalog stays server-side behind find_demo, and the client only ever sees the resolved
 * asset inside a stage directive. Do not build UI that assumes the whole catalog is present.
 */

import raw from '@catalog/demo-catalog.json'
import type { Chapter, StageAsset, StageAssetType, WalkthroughStep } from '@/types/stageDirective'
import { placeholderImage } from '@/placeholder'

/**
 * False in a static build such as GitHub Pages, where the demo videos are deliberately
 * absent: they are unapproved NiCE marketing masters and are not in the repository.
 *
 * When false, no asset gets a `src`, so the video renderer falls back to its synthetic clock
 * and a generated placeholder poster. The chapter and talk-track mechanism stays fully
 * demonstrable without ever requesting a file that is not there.
 */
const MEDIA_AVAILABLE = import.meta.env.VITE_MEDIA_AVAILABLE !== 'false'

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return 'simulated playback'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')} · simulated playback`
}

export interface CatalogSource {
  provider: string
  url: string
  /** For embeds: the canonical public page, for attribution and as a fallback. */
  watchUrl?: string
  thumbnailUrl?: string
  requiresSignedUrl?: boolean
}

export interface CatalogAsset {
  id: string
  title: string
  summary: string
  type: StageAssetType
  approved: boolean
  products: string[]
  useCases: string[]
  personas: string[]
  depth: 'overview' | 'functional' | 'technical'
  industries?: string[]
  durationSeconds?: number
  sizeMB?: number
  source: CatalogSource
  chapters?: Chapter[]
  steps?: WalkthroughStep[]
  prerequisites?: string[]
  followUps?: string[]
  talkingPoints?: string[]
  keywords?: string[]
  reviewedOn?: string
  reviewedBy?: string
}

export interface CatalogFile {
  version: string
  updated?: string
  notes?: string
  assets: CatalogAsset[]
  tours?: unknown[]
}

// Cast once. JSON module inference collapses the asset union and drops optional fields that
// no current entry happens to use, which is not worth fighting at every call site.
export const catalog = raw as unknown as CatalogFile

export function findAsset(id: string): CatalogAsset | undefined {
  return catalog.assets.find((asset) => asset.id === id)
}

/**
 * Projects a catalog entry into the subset the stage actually renders.
 *
 * This is the shape the backend will produce for real. Keeping the mapping in one place
 * means the mock and the eventual tool emit identical directives.
 */
export function toStageAsset(id: string): StageAsset | null {
  const entry = findAsset(id)
  if (!entry) {
    console.warn(`[showroom] no catalog entry for asset id "${id}"`)
    return null
  }

  const asset: StageAsset = {
    id: entry.id,
    type: entry.type,
    title: entry.title,
  }

  // Embeds are hosted publicly by a third party, so they work everywhere including the static
  // Pages build. Only locally-served media is withheld when MEDIA_AVAILABLE is false, and it is
  // withheld entirely rather than emitting a URL that 404s: hasRealSource() then reports false
  // and the renderer degrades deliberately.
  const isEmbed = entry.type === 'embed'
  if ((MEDIA_AVAILABLE || isEmbed) && entry.source.url) asset.src = entry.source.url
  if (entry.source.watchUrl) asset.watchUrl = entry.source.watchUrl

  if (entry.source.thumbnailUrl) {
    asset.posterUrl = entry.source.thumbnailUrl
  } else if (!MEDIA_AVAILABLE && !isEmbed) {
    asset.posterUrl = placeholderImage(entry.title, formatDuration(entry.durationSeconds))
  }

  if (entry.durationSeconds !== undefined) asset.durationSeconds = entry.durationSeconds
  if (entry.chapters?.length) asset.chapters = entry.chapters
  if (entry.steps?.length) asset.steps = entry.steps

  return asset
}

/**
 * Keyword search over the catalog.
 *
 * Deliberately the same scoring shape as the Cognigy find_demo tool, so mock mode and the live
 * agent rank the same way and a demo in one is representative of the other. Not a semantic
 * search: with thirty assets and rich keyword lists, term overlap is enough, and it is
 * debuggable in a way an embedding is not.
 */
export function searchCatalog(query: string, limit = 3): CatalogAsset[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)

  if (terms.length === 0) return []

  const scored = catalog.assets.map((asset) => {
    const haystack = [
      asset.title,
      asset.summary,
      asset.products.join(' '),
      asset.useCases.join(' '),
      (asset.keywords ?? []).join(' '),
      (asset.industries ?? []).join(' '),
      (asset.chapters ?? []).map((chapter) => chapter.label).join(' '),
    ]
      .join(' ')
      .toLowerCase()

    let score = 0
    for (const term of terms) if (haystack.includes(term)) score += 1
    // Nudge assets that can actually be guided, since a chaptered asset gives a better answer.
    if (score > 0 && asset.chapters?.length) score += 0.5
    return { asset, score }
  })

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.asset)
}

export function formatRuntime(seconds: number | undefined): string {
  if (!seconds) return 'unknown length'
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return 'under a minute'
  return `${minutes} min`
}

/** Assets with no chapters yet. Surfaced in the UI so the gap is visible, not silent. */
export function assetsMissingChapters(): CatalogAsset[] {
  return catalog.assets.filter((asset) => asset.type === 'video' && !asset.chapters?.length)
}
