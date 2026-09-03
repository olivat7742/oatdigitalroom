import type { ConnectionState, InboundMessage, Transport } from './types'
import { toStageAsset } from '@/catalog'
import { STAGE_DIRECTIVE_VERSION } from '@/types/stageDirective'

/** Proxied by the dev server to the real endpoint, so the URL token stays server-side. */
const ENDPOINT = '/api/cognigy'

/**
 * Sent on connect so the agent produces the opening turn rather than the client faking one.
 * Not displayed as a visitor message.
 */
const PRIMING_MESSAGE = 'Hello'

interface CognigyOutput {
  text?: string | null
  data?: unknown
}

interface CognigyResponse extends CognigyOutput {
  outputStack?: CognigyOutput[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Turns the agent's `assetRef` into the full asset the stage contract expects.
 *
 * MOCKUP SHIM. The Cognigy tool sends only an asset id, because this build has no
 * server-side resolver that could produce a real (and, for private hosting, signed) media
 * URL. So the transport fills it in from the local catalog copy.
 *
 * This is the one place that knowingly bends the thin-renderer rule, and it is contained
 * here on purpose: the store and the Stage still receive a fully-formed directive and know
 * nothing about it. When a real backend resolves URLs, delete this function and the
 * `assetRef` branch in the Cognigy code node.
 */
function resolveAssetRef(data: unknown): unknown {
  if (!isRecord(data)) return data
  const directive = data['_showroom']
  if (!isRecord(directive)) return data

  const assetRef = directive['assetRef']
  if (typeof assetRef !== 'string') return data

  const asset = toStageAsset(assetRef)
  if (!asset) {
    console.warn(`[showroom] agent referenced unknown assetRef "${assetRef}"`)
    return data
  }

  const { assetRef: _dropped, ...rest } = directive
  return { ...data, _showroom: { ...rest, v: STAGE_DIRECTIVE_VERSION, asset } }
}

/**
 * Collects every payload the agent emitted this turn, across the whole output stack.
 *
 * One turn can carry more than one: a stage directive from show_demo and a visitor payload
 * from save_visitor_profile arrive as separate data-only outputs. An earlier version returned
 * the first `_showroom` it found and discarded everything else, which silently dropped the
 * visitor payload and left the header unpersonalised with no error anywhere.
 *
 * The REST response's top-level `data` only retains one payload, so the stack has to be
 * scanned rather than trusted to summarise itself.
 */
function collectPayloads(response: CognigyResponse): Record<string, unknown> | undefined {
  const KEYS = ['_showroom', '_visitor'] as const
  const merged: Record<string, unknown> = {}

  const sources: unknown[] = [response.data, ...(response.outputStack ?? []).map((o) => o.data)]

  for (const source of sources) {
    if (!isRecord(source)) continue
    for (const key of KEYS) {
      // Later outputs win, so the newest state in the turn is the one applied.
      if (isRecord(source[key])) merged[key] = source[key]
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

export class CognigyTransport implements Transport {
  readonly name = 'cognigy'

  private readonly sessionId: string
  private readonly userId = 'digital-room-visitor'
  private messageHandler: ((m: InboundMessage) => void) | null = null
  private typingHandler: ((t: boolean) => void) | null = null
  private connectionHandler: ((s: ConnectionState) => void) | null = null
  private disposed = false

  constructor(sessionId?: string) {
    // Stable per page load so multi-turn context is preserved server-side.
    this.sessionId = sessionId ?? `dr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  onMessage(handler: (m: InboundMessage) => void): void {
    this.messageHandler = handler
  }

  onTyping(handler: (t: boolean) => void): void {
    this.typingHandler = handler
  }

  onConnectionChange(handler: (s: ConnectionState) => void): void {
    this.connectionHandler = handler
  }

  async connect(): Promise<void> {
    this.disposed = false
    this.connectionHandler?.('connecting')
    // The opening turn comes from the agent, so a failure here surfaces immediately rather
    // than on the visitor's first question.
    await this.post(PRIMING_MESSAGE, { markOpen: true })
  }

  disconnect(): void {
    this.disposed = true
    this.typingHandler?.(false)
    this.connectionHandler?.('closed')
  }

  send(text: string): void {
    void this.post(text)
  }

  private async post(text: string, opts: { markOpen?: boolean } = {}): Promise<void> {
    this.typingHandler?.(true)

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId, sessionId: this.sessionId, text, data: {} }),
      })

      if (!response.ok) throw new Error(`endpoint returned ${response.status}`)

      const payload = (await response.json()) as CognigyResponse
      if (this.disposed) return

      if (opts.markOpen) this.connectionHandler?.('open')
      this.typingHandler?.(false)

      const payloads = collectPayloads(payload)
      const spoken = typeof payload.text === 'string' ? payload.text.trim() : ''

      // One inbound message carrying every part of the turn: text for the rail, _showroom for
      // the stage, _visitor for the header chrome.
      const inbound: InboundMessage = {}
      if (spoken) inbound.text = spoken
      if (payloads) inbound.data = resolveAssetRef(payloads)

      if (inbound.text || inbound.data) {
        this.messageHandler?.(inbound)
      } else {
        // An empty turn almost always means the agent's LLM is misconfigured. Say so rather
        // than leaving the visitor looking at nothing.
        this.messageHandler?.({
          text: 'The guide returned an empty response. That usually means the agent has no working LLM connection.',
        })
      }
    } catch (error) {
      if (this.disposed) return
      this.typingHandler?.(false)
      this.connectionHandler?.('error')
      console.error('[showroom] Cognigy request failed', error)
      this.messageHandler?.({
        text: 'I could not reach the guide. Check that COGNIGY_ENDPOINT_URL is set in app/.env.local and that the dev server was restarted after setting it.',
      })
    }
  }
}
