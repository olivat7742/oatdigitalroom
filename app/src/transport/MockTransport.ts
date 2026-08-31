import type { ConnectionState, InboundMessage, Transport } from './types'
import { FALLBACK, GREETING, SCRIPT, type ScriptedStep } from '@/fixtures/conversation'

/**
 * Fixture-driven transport. No network, no backend, no model.
 *
 * Replaced by CognigyTransport (@cognigy/socket-client) once the agent is live. The point
 * of this class is that the swap should be the only change required: everything else in the
 * app talks to the Transport interface.
 */
export class MockTransport implements Transport {
  readonly name = 'mock'

  private messageHandler: ((m: InboundMessage) => void) | null = null
  private typingHandler: ((t: boolean) => void) | null = null
  private connectionHandler: ((s: ConnectionState) => void) | null = null
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false

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
    await this.wait(250)
    if (this.disposed) return
    this.connectionHandler?.('open')
    this.replay(GREETING)
  }

  disconnect(): void {
    this.disposed = true
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    this.typingHandler?.(false)
    this.connectionHandler?.('closed')
  }

  send(text: string): void {
    const turn = SCRIPT.find((candidate) => candidate.match.test(text))
    this.replay(turn ? turn.steps : FALLBACK)
  }

  /**
   * Plays a scripted sequence with a typing indicator in between, so the pacing of the real
   * thing is visible during review. Latency here is cosmetic and intentionally generous.
   */
  private replay(steps: ScriptedStep[]): void {
    let elapsed = 0
    this.typingHandler?.(true)

    steps.forEach((step, index) => {
      elapsed += step.delayMs
      const isLast = index === steps.length - 1
      this.schedule(() => {
        if (isLast) this.typingHandler?.(false)
        this.messageHandler?.(step.message)
      }, elapsed)
    })
  }

  private schedule(fn: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      if (!this.disposed) fn()
    }, delay)
    this.timers.add(timer)
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.schedule(resolve, ms))
  }
}
