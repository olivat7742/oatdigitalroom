/**
 * Loads the real demo catalog.
 *
 * In mock mode this is imported client-side because there is no backend. In production the
 * catalog stays server-side behind find_demo, and the client only ever sees the resolved
 * asset inside a stage directive. Do not build UI that assumes the whole catalog is present.
 */

import raw from '@catalog/demo-catalog.json'
import type { Chapter, StageAsset, StageAssetType, WalkthroughStep } from '@/types/stageDirective'

export interface CatalogSource {
  provider: string
  url: string
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
  durationSeconds?: number
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

  if (entry.source.url) asset.src = entry.source.url
  if (entry.source.thumbnailUrl) asset.posterUrl = entry.source.thumbnailUrl
  if (entry.durationSeconds !== undefined) asset.durationSeconds = entry.durationSeconds
  if (entry.chapters?.length) asset.chapters = entry.chapters
  if (entry.steps?.length) asset.steps = entry.steps

  return asset
}

/** Assets with no chapters yet. Surfaced in the UI so the gap is visible, not silent. */
export function assetsMissingChapters(): CatalogAsset[] {
  return catalog.assets.filter((asset) => asset.type === 'video' && !asset.chapters?.length)
}
