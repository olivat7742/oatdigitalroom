/**
 * Loads the real demo catalog.
 *
 * In mock mode this is imported client-side because there is no backend. In production the
 * catalog stays server-side behind find_demo, and the client only ever sees the resolved
 * asset inside a stage directive. Do not build UI that assumes the whole catalog is present.
 */

import raw from '@catalog/demo-catalog.json'
import type { AssetReference, Chapter, StageAsset, StageAssetType, WalkthroughStep } from '@/types/stageDirective'
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
  /** For documents: NiCE's own content type, for example 'Case study'. Never inferred. */
  documentType?: string
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
  references?: AssetReference[]
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

  // Embeds and documents live at public addresses, so they work everywhere including the static
  // Pages build. Only locally-served media is withheld when MEDIA_AVAILABLE is false, and it is
  // withheld entirely rather than emitting a URL that 404s: hasRealSource() then reports false
  // and the renderer degrades deliberately.
  const isPublic = entry.type === 'embed' || entry.type === 'document'
  if ((MEDIA_AVAILABLE || isPublic) && entry.source.url) asset.src = entry.source.url
  if (entry.source.watchUrl) asset.watchUrl = entry.source.watchUrl

  // Documents are chosen from a card, not watched, so the stage needs the description and the
  // publisher's own labels. Only documents carry these: adding them to every asset type would
  // put a paragraph of marketing copy over a playing video.
  if (entry.type === 'document') {
    if (entry.summary) asset.summary = entry.summary
    const badges = [entry.documentType, ...(entry.industries ?? [])].filter(
      (badge): badge is string => Boolean(badge),
    )
    if (badges.length) asset.badges = badges.slice(0, 6)
  }

  if (entry.source.thumbnailUrl) {
    asset.posterUrl = entry.source.thumbnailUrl
  } else if (!MEDIA_AVAILABLE && !isPublic) {
    asset.posterUrl = placeholderImage(entry.title, formatDuration(entry.durationSeconds))
  }

  if (entry.durationSeconds !== undefined) asset.durationSeconds = entry.durationSeconds
  if (entry.chapters?.length) asset.chapters = entry.chapters
  if (entry.steps?.length) asset.steps = entry.steps
  if (entry.references?.length) asset.references = entry.references

  return asset
}

/**
 * Words that carry no retrieval signal but appear in almost every asset's prose.
 *
 * Without these, a question scored hits for "for", "its" and "how", so length was rewarded
 * over relevance: "How does a retailer modernise its contact center?" returned a healthcare
 * case study, because the healthcare summary happened to contain more filler words.
 */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'can', 'how', 'what', 'who', 'why',
  'does', 'did', 'was', 'were', 'has', 'have', 'had', 'this', 'that', 'these', 'those', 'its',
  'from', 'into', 'about', 'any', 'all', 'some', 'more', 'most', 'show', 'tell', 'see', 'give',
  'get', 'need', 'want', 'like', 'use', 'using', 'used', 'work', 'works', 'there', 'their',
  'they', 'them', 'his', 'her', 'not', 'but', 'out', 'when', 'where', 'which', 'would', 'could',
  'should', 'will', 'shall', 'may', 'might', 'must', 'one', 'two', 'anything', 'something',
  'someone', 'read', 'look', 'find', 'know', 'make', 'made', 'doing', 'been', 'being',
  // Domain noise. In a catalog of B2B customer stories every asset is about a company in some
  // industry, so these discriminate nothing while scoring a full title hit: "any proof from an
  // insurance company?" returned "Student Loans Company Turned Its Scheduling Team..." purely
  // because the word "Company" is in that title.
  'company', 'companies', 'organisation', 'organization', 'organisations', 'organizations',
  'business', 'businesses', 'customer', 'customers', 'client', 'clients',
])

/**
 * Crude suffix stripping, so a visitor's word form matches the catalog's.
 *
 * Matching is substring containment, which is asymmetric: the indexed word "retail" does not
 * contain the query word "retailer", so "How does a retailer modernise..." found nothing while
 * "retail" found the right case study. Likewise "analysts" missed "analyst" and the British
 * "modernise" missed "modernization".
 *
 * Stripping at most TWO trailing characters, with a five-character floor, handles all three:
 * retailer to retail, modernise to moderni, analysts to analyst, utilities to utiliti.
 *
 * Stems are returned SEPARATELY from the exact term because they are weaker evidence and are
 * scored lower. No cap makes stemming safe on its own: "agentic" is seven letters, so even a
 * two-character strip yields exactly "agent", and agentic and agent are different things in
 * this domain. What stops that mattering is the scoring, not the truncation: helen's title
 * contains "agentic" exactly and outranks a title that merely contains "Agents".
 */
function stemsOf(term: string): string[] {
  const out: string[] = []

  // Explicit English endings FIRST. Generic truncation alone cannot strip a three-letter
  // suffix, so "reskilling" never reached "reskill" and the question "jump straight to the
  // reskilling recommendations" stopped matching the chapter labelled Reskill. That was a
  // regression introduced by replacing an older -ing/-s stemmer with truncation; both are
  // needed, because truncation catches "retailer" and endings catch "reskilling".
  if (term.length > 5 && term.endsWith('ing')) out.push(term.slice(0, -3))
  if (term.length > 4 && term.endsWith('ed')) out.push(term.slice(0, -2))
  if (term.length > 4 && term.endsWith('ies')) out.push(`${term.slice(0, -3)}y`)
  if (term.length > 4 && term.endsWith('es')) out.push(term.slice(0, -2))
  if (term.length > 3 && term.endsWith('s')) out.push(term.slice(0, -1))

  for (let end = term.length - 1; end >= 5 && end >= term.length - 2; end -= 1) {
    out.push(term.slice(0, end))
  }
  return out.filter((stem, index) => stem.length >= 3 && out.indexOf(stem) === index)
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Per-term matchers: one for the exact word, and weaker ones for its stems.
 *
 * Both anchor at the START of a word. Plain substring containment made stemming unsafe in a
 * way that is easy to miss: "Do you sell tractors?" matched an executive keynote, because the
 * stem "tract" is inside "attract". The leading \b keeps "retail" matching "retailer" while
 * refusing "tract" inside "attract".
 *
 * Built once per query rather than per asset, since it is the same work for all 66 of them.
 */
function matchersFor(terms: string[]): { exact: RegExp; stems: RegExp[] }[] {
  return terms.map((term) => ({
    exact: new RegExp(`\\b${escape(term)}\\b`),
    stems: stemsOf(term).map((stem) => new RegExp(`\\b${escape(stem)}`)),
  }))
}

/** Title says what a thing IS; summary merely mentions things. See searchCatalog. */
const FIELD_WEIGHT = { title: 3, identifying: 2, descriptive: 1 }

/**
 * A stem match is real evidence but weaker than the visitor's actual word, so it scores below
 * one. Without this, "agentic" and "agent" were worth the same and a telecom video tied with
 * the utilities case study the question was actually about.
 */
const STEM_FACTOR = 0.85

/**
 * Keyword search over the catalog.
 *
 * The same scoring shape as the Cognigy find_demo tool, so mock mode and the live agent rank
 * the same way and a demo in one is representative of the other. When these drift, mock mode
 * stops being evidence about the real thing, which is the only reason it exists.
 *
 * Not a semantic search. With a few dozen assets and rich keyword lists, term overlap is
 * enough, and it is debuggable in a way an embedding is not.
 *
 * Two rules do most of the work:
 *
 * Fields are split into IDENTIFYING and DESCRIPTIVE, and a match needs at least one
 * identifying hit. Title, products, industries, document type and keywords say what a thing
 * IS; summary, use cases and chapter labels merely mention things. Without this split
 * "billing dispute handling" matched an asset whose summary said "application handling".
 *
 * A document's own content type is an identifying field, so "do you have a case study
 * for..." matches case studies rather than anything that discusses one.
 */
export function searchCatalog(query: string, limit = 3): CatalogAsset[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term))

  if (terms.length === 0) return []

  const termMatchers = matchersFor(terms)

  const scored = catalog.assets.map((asset) => {
    // The title is the strongest field of all, so it scores above the rest of the identifying
    // group. Without this tier, "any proof from an insurance company?" ranked two videos that
    // merely list Insurance among their relevant industries above the case study that IS an
    // insurance customer story, because a title hit and an industries hit weighed the same.
    const titleText = asset.title.toLowerCase()

    const identifying = [
      asset.products.join(' '),
      (asset.industries ?? []).join(' '),
      asset.documentType ?? '',
      (asset.keywords ?? []).join(' '),
    ]
      .join(' ')
      .toLowerCase()

    const descriptive = [
      asset.summary,
      asset.useCases.join(' '),
      (asset.chapters ?? []).map((chapter) => chapter.label).join(' '),
    ]
      .join(' ')
      .toLowerCase()

    // Best field wins per term, exact before stem within each field. Ordering the six
    // possibilities explicitly beats a clever loop: the ranking IS the product decision.
    const fields = [
      { text: titleText, weight: FIELD_WEIGHT.title, identifies: true },
      { text: identifying, weight: FIELD_WEIGHT.identifying, identifies: true },
      { text: descriptive, weight: FIELD_WEIGHT.descriptive, identifies: false },
    ]

    let score = 0
    let identifyingHits = 0
    for (const { exact, stems } of termMatchers) {
      let best = 0
      let bestIdentifies = false
      for (const field of fields) {
        const value = exact.test(field.text)
          ? field.weight
          : stems.some((stem) => stem.test(field.text))
            ? field.weight * STEM_FACTOR
            : 0
        if (value > best) {
          best = value
          bestIdentifies = field.identifies
        }
      }
      score += best
      if (bestIdentifies) identifyingHits += 1
    }

    // Nudge assets that can actually be guided, since a chaptered asset gives a better answer.
    if (identifyingHits > 0 && asset.chapters?.length) score += 0.5
    return { asset, score, identifyingHits }
  })

  return scored
    .filter((entry) => entry.identifyingHits > 0)
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
