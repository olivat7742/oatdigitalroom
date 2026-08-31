import { create } from 'zustand'
import { extractDirective, type Cta, type StageAsset, type StageDirective, type TourInfo } from '@/types/stageDirective'
import type { ConnectionState, InboundMessage, Transport } from '@/transport/types'

export type MessageRole = 'agent' | 'visitor' | 'narration' | 'system'

export interface Message {
  id: string
  role: MessageRole
  text: string
  at: number
}

export interface StageState {
  asset: StageAsset | null
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

    case 'show':
    case 'play':
      return {
        asset: directive.asset ?? null,
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

    set((state) => {
      const next: Partial<SessionState> = {}

      if (inbound.text) {
        next.messages = [...state.messages, message('agent', inbound.text)]
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
