/**
 * Transport abstraction between the Showroom and whatever is driving it.
 *
 * Two implementations are planned:
 *   MockTransport    fixture-driven, no backend, used until the Cognigy agent is live
 *   CognigyTransport @cognigy/socket-client, added in Phase 2 once the agent exists
 *
 * Keeping this interface tiny is what lets the UI be built and reviewed before the agent
 * is ready, and it is also the seam for testing directive handling without a network.
 */

export interface InboundMessage {
  /** Text spoken by the agent. May be absent on a pure stage-control message. */
  text?: string
  /** Arbitrary payload. The Showroom looks for `_showroom` inside it. */
  data?: unknown
}

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export interface Transport {
  readonly name: string
  connect(): Promise<void>
  disconnect(): void
  /** Send visitor input to the agent. */
  send(text: string): void
  onMessage(handler: (message: InboundMessage) => void): void
  onTyping(handler: (typing: boolean) => void): void
  onConnectionChange(handler: (state: ConnectionState) => void): void
}
