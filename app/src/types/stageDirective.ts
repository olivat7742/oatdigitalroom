/**
 * Mirrors contracts/stage-directive.schema.json.
 *
 * These types are the entire vocabulary the frontend understands. The design rule is that
 * the Stage is a thin renderer: it never infers anything that is not present in a
 * directive. If a new behaviour is needed, it is added to the contract first, in both
 * places, and only then rendered here.
 */

export const STAGE_DIRECTIVE_VERSION = 1

export type StageAssetType =
  | 'video'
  | 'walkthrough'
  | 'diagram'
  | 'comparison'
  | 'document'
  /**
   * Third-party player in an iframe, currently YouTube. Differs from 'video' in that the host
   * page cannot read playback position, so position is a load-time start offset and chapter
   * narration does not apply.
   */
  | 'embed'

export type StageAction =
  | 'show'
  | 'play'
  | 'pause'
  | 'seek'
  | 'highlight'
  | 'step'
  | 'clear'
  /**
   * Offers quick-reply buttons and touches the stage not at all.
   *
   * Needed because cta is applied independently of the action, but every other action has a
   * side effect: 'clear' empties the stage, 'pause' stops a playing video. Without this, a tool
   * that wants to offer choices has to disturb what the visitor is looking at to do it.
   */
  | 'offer'
  /**
   * Replaces the stage with the closing summary. The chat stays open and the visitor can keep
   * going, so this is a change of view rather than the end of a session.
   */
  | 'wrapup'

export type CtaKind = 'quick_reply' | 'next_asset' | 'tour_next' | 'tour_back' | 'handoff'

export interface Chapter {
  /** Start time in seconds. */
  t: number
  label: string
  /** What the agent says while this chapter plays. See ChatRail for why the client renders it. */
  talkTrack?: string
}

export interface Hotspot {
  /** Fractions of image width and height, 0 to 1. */
  x: number
  y: number
  w: number
  h: number
}

export interface WalkthroughStep {
  imageUrl: string
  caption: string
  hotspot?: Hotspot
}

export interface StageAsset {
  id: string
  type: StageAssetType
  title?: string
  /**
   * Shown on the stage for documents, where the visitor is deciding whether the thing is worth
   * opening. Carried from the catalog, never written by the agent, so the stage shows the
   * publisher's own description rather than a generated paraphrase of it.
   */
  summary?: string
  /**
   * Short factual labels for a document: its content type and industries. Every value comes
   * from the publisher's taxonomy, because these read as facts about the resource.
   */
  badges?: string[]
  /** Resolved by the backend. The client never assembles a URL. */
  src?: string
  /** For embeds: the canonical public page, for attribution and as a fallback. */
  watchUrl?: string
  posterUrl?: string
  durationSeconds?: number
  chapters?: Chapter[]
  steps?: WalkthroughStep[]
  /** Public links for further reading, carried from the catalog. */
  references?: AssetReference[]
}

export interface TourInfo {
  id: string
  title?: string
  /** One-based. */
  step: number
  totalSteps: number
}

export interface Cta {
  label: string
  value: string
  kind: CtaKind
}

/** A public link offered under an agent reply so the visitor can read more later. */
export interface AssetReference {
  label: string
  url: string
}

export interface ViewedAsset {
  assetId: string
  title: string
  durationSeconds?: number
  /** Present only where the asset has a genuinely public address. */
  watchUrl?: string
  references?: AssetReference[]
}

export interface SummaryTopic {
  id: string
  label: string
  /** True for topics drawn from what they actually watched, rather than adjacent suggestions. */
  preselected?: boolean
}

/**
 * Whether NiCE already has a relationship with the visitor's company.
 *
 * Absent when no lookup happened, which is deliberate: a NiCE employee browsing for their own
 * knowledge is not a lead and must not be shown either branch of this.
 */
export interface SummaryCrm {
  status: 'known' | 'new-lead'
  /** Only meaningful when status is 'known'. A new lead has nobody assigned yet. */
  salesRepName?: string
  salesRepRole?: string
  accountName?: string
  matchType?: 'opportunity' | 'account' | 'contact' | 'lead'
}

export interface StageSummary {
  headline?: string
  viewed: ViewedAsset[]
  topics: SummaryTopic[]
  crm?: SummaryCrm
  /**
   * Whether an email was captured. The panel must not treat this as permission to use it:
   * having someone's address is not their consent to be contacted.
   */
  emailKnown?: boolean
}

export interface StageDirective {
  v: number
  action: StageAction
  asset?: StageAsset
  summary?: StageSummary
  /** Seconds for seek, zero-based index for step. */
  position?: number
  tour?: TourInfo
  cta?: Cta[]
}

const ACTIONS: readonly StageAction[] = [
  'show',
  'play',
  'pause',
  'seek',
  'highlight',
  'step',
  'clear',
  'offer',
  'wrapup',
]

const ASSET_TYPES: readonly StageAssetType[] = [
  'video',
  'walkthrough',
  'diagram',
  'comparison',
  'document',
  'embed',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Pulls a directive out of a message `data` payload, or returns null.
 *
 * Deliberately strict. An unrecognised version is ignored rather than guessed at, because a
 * future contract may reuse an action name with different semantics, and rendering a
 * confident wrong thing is the specific failure this product cannot afford.
 */
export function extractDirective(data: unknown): StageDirective | null {
  if (!isRecord(data)) return null

  const envelope = data['_showroom']
  if (!isRecord(envelope)) return null

  if (envelope['v'] !== STAGE_DIRECTIVE_VERSION) {
    console.warn(
      `[showroom] ignoring stage directive with unsupported version ${String(envelope['v'])}; this client supports v${STAGE_DIRECTIVE_VERSION}`,
    )
    return null
  }

  const action = envelope['action']
  if (typeof action !== 'string' || !ACTIONS.includes(action as StageAction)) {
    console.warn(`[showroom] ignoring stage directive with unknown action ${String(action)}`)
    return null
  }

  const asset = isRecord(envelope['asset']) ? (envelope['asset'] as unknown as StageAsset) : undefined
  if (asset && !ASSET_TYPES.includes(asset.type)) {
    console.warn(`[showroom] ignoring stage directive for unknown asset type ${String(asset.type)}`)
    return null
  }

  // show and play must carry an asset; the other actions operate on what is already loaded.
  if ((action === 'show' || action === 'play') && !asset) {
    console.warn(`[showroom] ignoring ${action} directive with no asset`)
    return null
  }

  const summary = isRecord(envelope['summary'])
    ? (envelope['summary'] as unknown as StageSummary)
    : undefined

  // A wrapup with no summary would blank the stage and show an empty panel, which reads as a
  // broken app rather than a closing screen.
  if (action === 'wrapup' && (!summary || !Array.isArray(summary.viewed) || !Array.isArray(summary.topics))) {
    console.warn('[showroom] ignoring wrapup directive with no usable summary')
    return null
  }

  return {
    v: STAGE_DIRECTIVE_VERSION,
    action: action as StageAction,
    asset,
    summary,
    position: typeof envelope['position'] === 'number' ? envelope['position'] : undefined,
    tour: isRecord(envelope['tour']) ? (envelope['tour'] as unknown as TourInfo) : undefined,
    cta: Array.isArray(envelope['cta']) ? (envelope['cta'] as Cta[]).slice(0, 4) : undefined,
  }
}

/** True when the asset has a real, loadable source rather than a catalog placeholder. */
export function hasRealSource(asset: StageAsset | null): boolean {
  if (!asset?.src) return false
  return asset.src !== 'REPLACE_ME'
}
