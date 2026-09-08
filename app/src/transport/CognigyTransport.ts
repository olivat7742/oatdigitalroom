import type { ConnectionState, InboundMessage, Transport } from './types'
import { toStageAsset } from '@/catalog'
import { lookupContact } from '@/crm'
import { IDENTITY_CTA, identityQuestion, isIdentityRejection } from '@/identity'
import { roomParams } from '@/roomParams'
import { activeTemplate } from '@/templates'
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

  /**
   * The visitor the launch URL claimed this is, sent to the agent so it need not ask what we
   * already know. Resolved here rather than in the store, because it comes from the URL and
   * the store has no business knowing about URLs.
   */
  private readonly launch = lookupContact(roomParams.contactId)

  /**
   * Stops sending the launch identity once the agent reports the introduction finished.
   *
   * It is sent on EVERY turn until then, not just the first. The model does not reliably call
   * save_visitor_profile on the opening turn, and Cognigy only carries client `data` for the
   * turn it was sent on, so a first-turn-only payload would be silently lost exactly when the
   * model skipped the tool call.
   */
  private introductionDone = false

  /**
   * Set while the portal has put the identity question and is waiting for the answer.
   *
   * Nothing is sent to the agent during this: the confirmation happens entirely client-side,
   * before the conversation starts. See app/src/identity.ts for why the portal owns it.
   */
  private awaitingIdentity = false

  /** Whether the visitor accepted the claimed identity, and whether they refused it. */
  private identityConfirmed = false
  private identityRejected = false

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

    // The one case where the opening turn does NOT come from the agent.
    //
    // With a claimed identity the portal asks the confirmation itself and sends the agent
    // nothing until it is answered, because consent must not depend on the model deciding to
    // call a tool. Mock mode has always worked this way; this makes live match it.
    if (this.launch) {
      this.awaitingIdentity = true

      // Yields before emitting, and then checks disposed. Not cosmetic: React StrictMode mounts
      // the effect twice in development, so a message emitted synchronously here arrives from
      // the first transport before it is torn down AND from its replacement, and the visitor saw
      // the confirmation twice. The posting path never showed this because an in-flight request
      // resolves after disposal and returns early. Same reason MockTransport waits.
      await new Promise((resolve) => setTimeout(resolve, 200))
      if (this.disposed) return

      this.connectionHandler?.('open')
      const opener = activeTemplate.welcome ? `${activeTemplate.welcome}\n\n` : ''
      this.messageHandler?.({
        text: `${opener}${identityQuestion(this.launch.firstName, this.launch.accountName)}`,
        data: { _showroom: { v: STAGE_DIRECTIVE_VERSION, action: 'clear', cta: IDENTITY_CTA } },
      })
      return
    }

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
    // The answer to the portal's own question, settled here and not forwarded as a query.
    //
    // The text is still posted, so the agent's first turn sees "Yes, that's me" or "Not me" as
    // the opening user message and the transcript reads naturally. What changes is the launch
    // payload that goes with it: confirmed, or absent entirely.
    if (this.awaitingIdentity) {
      this.awaitingIdentity = false
      if (isIdentityRejection(text)) this.identityRejected = true
      else this.identityConfirmed = true
    }
    void this.post(text)
  }

  /**
   * What the client tells the agent, which is only ever the claimed identity.
   *
   * The agent decides what to do with it: it offers it back for confirmation and records
   * nothing until the visitor accepts, exactly as mock mode does. The portal deliberately does
   * NOT pre-confirm on the agent's behalf, because people forward invitations and the person
   * in the room is the only one who can settle who they are.
   */
  private launchPayload(): Record<string, unknown> {
    if (!this.launch || this.introductionDone) return {}
    // A refusal sends NOTHING. The agent must not be told about a person the visitor has just
    // said they are not, or a forwarded invitation would still colour the whole session.
    if (this.identityRejected) return {}
    // Nor is anything sent before the answer: the agent has no business acting on a claimed
    // identity while the question is still on screen.
    if (this.awaitingIdentity) return {}

    const { contactId, firstName, lastName, jobTitle, email, accountName } = this.launch
    return {
      _launch: {
        v: 1,
        // The portal asked and the visitor accepted, so the agent can treat this as settled.
        // The node trusts this flag precisely because a deterministic step produced it, and
        // keeps its own gated fallback for channels that do not pre-confirm.
        confirmed: this.identityConfirmed,
        contactId,
        firstName,
        ...(lastName ? { lastName } : {}),
        ...(jobTitle ? { jobTitle } : {}),
        ...(email ? { email } : {}),
        ...(accountName ? { company: accountName } : {}),
      },
    }
  }

  private async post(text: string, opts: { markOpen?: boolean } = {}): Promise<void> {
    this.typingHandler?.(true)

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          sessionId: this.sessionId,
          text,
          data: this.launchPayload(),
        }),
      })

      if (!response.ok) throw new Error(`endpoint returned ${response.status}`)

      const payload = (await response.json()) as CognigyResponse
      if (this.disposed) return

      if (opts.markOpen) this.connectionHandler?.('open')
      this.typingHandler?.(false)

      const payloads = collectPayloads(payload)
      const spoken = typeof payload.text === 'string' ? payload.text.trim() : ''

      // Once the agent says the introduction is done there is nothing left for the launch
      // identity to save, so stop sending it rather than repeating it for the whole session.
      const visitor = payloads?.['_visitor']
      if (isRecord(visitor) && visitor['introductionComplete'] === true) {
        this.introductionDone = true
      }

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
