import { create } from 'zustand'
import {
  extractDirective,
  type AssetReference,
  type Cta,
  type StageAsset,
  type StageDirective,
  type StageSummary,
  type TourInfo,
} from '@/types/stageDirective'
import type { ConnectionState, InboundMessage, Transport } from '@/transport/types'
import { DEFAULT_REFERENCES } from '@/references'
import { extractVisitor, type Visitor } from '@/types/visitor'

export type MessageRole = 'agent' | 'visitor' | 'narration' | 'system'

/**
 * A citation attached to an agent reply so the visitor can bookmark it and come back later.
 *
 * `url` is only ever a genuinely public address. Local assets are served from the dev media
 * route, which is meaningless to anyone else, so they get `url: null` and the rail says so
 * rather than offering a link that dies the moment it is bookmarked.
 */
export interface MessageSource {
  title: string
  url: string | null
  durationSeconds?: number
}

export interface Message {
  id: string
  role: MessageRole
  text: string
  at: number
  /** The asset this reply put on the stage, if any. */
  source?: MessageSource
  /**
   * Further reading. Present on every agent reply, including the ones that deliberately give
   * the visitor nothing else, such as a pricing refusal or "there is no demo of that". Those
   * are exactly the moments when somewhere else to look is most valuable.
   */
  references?: AssetReference[]
}

export interface StageState {
  asset: StageAsset | null
  /** Closing summary. When set, it replaces the asset on the stage. */
  summary: StageSummary | null
  playing: boolean
  /** Zero-based index for walkthrough steps. */
  stepIndex: number
  highlighted: boolean
  /** Nonce lets a repeated seek to the same position still register. */
  seek: { position: number; nonce: number } | null
}

interface SessionState {
  messages: Message[]
  stage: StageState
  cta: Cta[]
  tour: TourInfo | null
  connection: ConnectionState
  agentTyping: boolean
  /** Who the agent has established the visitor is. Drives the header chrome only. */
  visitor: Visitor | null
  /** Chapter indices already narrated, so a rewind does not repeat the talk track. */
  narratedChapters: Set<string>

  attachTransport: (transport: Transport) => void
  sendVisitorMessage: (text: string) => void
  setStepIndex: (index: number) => void
  setPlaying: (playing: boolean) => void
  enterChapter: (chapterIndex: number) => void
  reset: () => void
}

const EMPTY_STAGE: StageState = {
  asset: null,
  summary: null,
  playing: false,
  stepIndex: 0,
  highlighted: false,
  seek: null,
}

let messageSeq = 0
function nextId(): string {
  messageSeq += 1
  return `m${messageSeq}`
}

function message(role: MessageRole, text: string): Message {
  return { id: nextId(), role, text, at: Date.now() }
}

/**
 * Applies a directive to stage state.
 *
 * Pure and exported so directive handling can be tested without mounting the app, which is
 * where the real risk of regression sits.
 */
export function applyDirective(stage: StageState, directive: StageDirective): StageState {
  switch (directive.action) {
    case 'clear':
      return { ...EMPTY_STAGE }

    case 'wrapup':
      // Replaces whatever was playing. The chat keeps running, so this is a change of view,
      // not the end of the session: any later show or play brings the stage straight back.
      return { ...EMPTY_STAGE, summary: directive.summary ?? null }

    case 'show':
    case 'play':
      return {
        asset: directive.asset ?? null,
        summary: null,
        playing: directive.action === 'play',
        stepIndex: 0,
        highlighted: false,
        // A position on show/play is a start offset, so the agent can open a video at a
        // chapter in one directive instead of a play-then-seek pair.
        seek:
          typeof directive.position === 'number'
            ? { position: directive.position, nonce: (stage.seek?.nonce ?? 0) + 1 }
            : null,
      }

    case 'pause':
      return { ...stage, playing: false }

    case 'seek':
      return {
        ...stage,
        playing: true,
        seek: { position: directive.position ?? 0, nonce: (stage.seek?.nonce ?? 0) + 1 },
      }

    case 'step':
      return { ...stage, stepIndex: Math.max(0, Math.floor(directive.position ?? 0)) }

    case 'highlight':
      return { ...stage, highlighted: true }

    // Buttons only. Returned unchanged on purpose: the cta is applied by the caller,
    // independently of the action, and this is the one action whose whole job is to leave the
    // stage alone while it happens.
    case 'offer':
      return stage

    default:
      return stage
  }
}

/**
 * Chapters the visitor is being skipped past, pre-marked as already narrated.
 *
 * Without this, opening an asset at an offset fires the wrong talk track. The clock starts at
 * zero for a frame before the seek lands, so chapter one narrates, and then the target chapter
 * narrates too. The visitor sees two unrelated narration blocks and the jump reads as
 * confused. Everything strictly before the landing chapter is suppressed; the landing chapter
 * itself still speaks.
 */
function skippedChapterKeys(directive: StageDirective): Set<string> {
  const skipped = new Set<string>()
  const asset = directive.asset
  const position = directive.position

  if (!asset?.chapters?.length || typeof position !== 'number') return skipped

  let landingIndex = 0
  asset.chapters.forEach((chapter, index) => {
    if (chapter.t <= position) landingIndex = index
  })
  for (let index = 0; index < landingIndex; index += 1) {
    skipped.add(`${asset.id}:${index}`)
  }
  return skipped
}

export const useSessionStore = create<SessionState>((set, get) => {
  let transport: Transport | null = null

  function handleInbound(inbound: InboundMessage): void {
    const directive = extractDirective(inbound.data)
    const visitorUpdate = extractVisitor(inbound.data)

    set((state) => {
      const next: Partial<SessionState> = {}

      // Merged, not replaced: the agent sends only what it just learned, so replacing would
      // drop everything established in earlier turns.
      if (visitorUpdate) {
        next.visitor = { ...(state.visitor ?? {}), ...visitorUpdate }
      }

      if (inbound.text) {
        const agentMessage = message('agent', inbound.text)

        // Cite whatever the agent just put on the stage, on the reply that introduced it. The
        // stage only ever shows the current asset, so without this the visitor loses the
        // reference as soon as the conversation moves on.
        const shownAsset = directive?.asset
        if (shownAsset && (directive?.action === 'show' || directive?.action === 'play')) {
          agentMessage.source = {
            title: shownAsset.title ?? shownAsset.id,
            url: shownAsset.watchUrl ?? null,
            ...(shownAsset.durationSeconds !== undefined
              ? { durationSeconds: shownAsset.durationSeconds }
              : {}),
          }
        }

        // Every agent reply carries further reading. Prefer the shown asset's own references,
        // which are product-specific, and fall back to the general ones so a reply that shows
        // nothing still leaves the visitor somewhere to go.
        //
        // Suppressed when identical to the previous agent reply's set. Without this the same
        // three links repeat under all five one-line questions of the opening introduction,
        // which turns a useful affordance into wallpaper. The set still reappears the moment
        // it changes, which is exactly when it carries new information.
        const references = shownAsset?.references?.length ? shownAsset.references : DEFAULT_REFERENCES

        // Compare against the last set actually SHOWN, not the previous message's field.
        // Comparing to the previous message resets on every suppressed turn, which made the
        // block alternate on and off rather than staying hidden.
        const lastShown = [...state.messages]
          .reverse()
          .find((m) => m.role === 'agent' && m.references?.length)
        const key = (list?: AssetReference[]) => (list ?? []).map((r) => r.url).join('|')

        if (key(references) !== key(lastShown?.references)) {
          agentMessage.references = references
        }

        next.messages = [...state.messages, agentMessage]
      }

      if (directive) {
        next.stage = applyDirective(state.stage, directive)

        // A new asset resets narration tracking, and cta/tour are replaced rather than
        // merged so a stale button from a previous turn can never linger.
        if (directive.action === 'show' || directive.action === 'play' || directive.action === 'clear') {
          next.narratedChapters = skippedChapterKeys(directive)
        }
        if (directive.cta !== undefined || directive.action === 'clear') {
          next.cta = directive.cta ?? []
        }
        if (directive.tour !== undefined) {
          next.tour = directive.tour
        } else if (directive.action === 'clear') {
          next.tour = null
        }
      }

      return next
    })
  }

  return {
    messages: [],
    stage: { ...EMPTY_STAGE },
    cta: [],
    tour: null,
    connection: 'idle',
    agentTyping: false,
    visitor: null,
    narratedChapters: new Set<string>(),

    attachTransport(next: Transport) {
      transport?.disconnect()
      transport = next
      next.onMessage(handleInbound)
      next.onTyping((typing) => set({ agentTyping: typing }))
      next.onConnectionChange((connection) => set({ connection }))
      void next.connect()
    },

    sendVisitorMessage(text: string) {
      const trimmed = text.trim()
      if (!trimmed || !transport) return
      // Clearing cta on send stops the visitor clicking a button that the next turn replaces.
      set((state) => ({ messages: [...state.messages, message('visitor', trimmed)], cta: [] }))
      transport.send(trimmed)
    },

    setStepIndex(index: number) {
      set((state) => ({ stage: { ...state.stage, stepIndex: index, highlighted: false } }))
    },

    setPlaying(playing: boolean) {
      set((state) => ({ stage: { ...state.stage, playing } }))
    },

    /**
     * Called by the video renderer when playback crosses into a chapter.
     *
     * The talk track is rendered client-side rather than round-tripped to the agent. It is
     * authored content delivered inside the directive, so displaying it on cue is rendering,
     * not generation, and the thin-renderer rule holds. The alternative, asking the agent to
     * speak on every chapter boundary, adds latency and token cost per chapter for text that
     * was already decided in the catalog.
     */
    enterChapter(chapterIndex: number) {
      const { stage, narratedChapters } = get()
      const chapter = stage.asset?.chapters?.[chapterIndex]
      if (!chapter?.talkTrack || !stage.asset) return

      const key = `${stage.asset.id}:${chapterIndex}`
      if (narratedChapters.has(key)) return

      set((state) => ({
        messages: [...state.messages, message('narration', chapter.talkTrack as string)],
        narratedChapters: new Set(state.narratedChapters).add(key),
      }))
    },

    reset() {
      set({
        messages: [],
        stage: { ...EMPTY_STAGE },
        cta: [],
        tour: null,
        narratedChapters: new Set<string>(),
      })
    },
  }
})
