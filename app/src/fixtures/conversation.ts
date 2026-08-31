/**
 * Fixture conversation for mock mode.
 *
 * This exists so the Showroom UI can be built and reviewed before the Cognigy agent is live.
 * It is a scripted keyword matcher, not a model.
 *
 * Videos are REAL files from the Resources directory, served by the dev media middleware in
 * vite.config.ts and described by catalog/demo-catalog.json. They have no chapters yet, so
 * chapter markers and talk tracks will not appear until catalog/chapters-todo.md is filled in.
 *
 * Walkthrough and diagram assets are still generated placeholders, watermarked MOCK ASSET,
 * because no real assets of those types exist yet.
 *
 * Agent wording here is deliberately procedural. It introduces and sequences content without
 * making capability claims, because nobody has reviewed these videos yet and the fixture is
 * not the place to invent a value proposition.
 */

import type { InboundMessage } from '@/transport/types'
import { toStageAsset } from '@/catalog'
import type { StageAsset } from '@/types/stageDirective'

/** Fails loudly at module load if a fixture drifts away from the catalog. */
function asset(id: string): StageAsset {
  const resolved = toStageAsset(id)
  if (!resolved) throw new Error(`Fixture references a missing catalog asset: ${id}`)
  return resolved
}

const COPILOT = asset('nice-copilot-for-agents')
const OUTBOUND = asset('outbound-engagement-compliance')
const SUPERVISOR = asset('supervisor-control-clarity-coaching')

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Generates a watermarked placeholder image as a data URI. No network, no assets on disk. */
export function placeholderImage(label: string, caption = ''): string {
  // NiCE palette so placeholders sit inside the brand rather than fighting it.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
  <defs>
    <pattern id="d" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="#f2f0eb" opacity="0.16"/>
    </pattern>
  </defs>
  <rect width="1280" height="720" fill="#22212b"/>
  <rect width="1280" height="720" fill="url(#d)"/>
  <circle cx="640" cy="212" r="34" fill="none" stroke="#3694fd" stroke-width="2"/>
  <path d="M630 200 L654 212 L630 224 Z" fill="#3694fd"/>
  <text x="640" y="340" font-family="Be Vietnam Pro, Segoe UI, Helvetica, Arial, sans-serif" font-size="46" font-weight="500" letter-spacing="-1.4" fill="#f2f0eb" text-anchor="middle">${escapeXml(label)}</text>
  <text x="640" y="392" font-family="Be Vietnam Pro, Segoe UI, Helvetica, Arial, sans-serif" font-size="23" font-weight="300" fill="#6d6d72" text-anchor="middle">${escapeXml(caption)}</text>
  <g>
    <rect x="546" y="456" width="188" height="40" rx="20" fill="none" stroke="#ff5b8a" stroke-width="1.5"/>
    <text x="640" y="482" font-family="Be Vietnam Pro, Segoe UI, Helvetica, Arial, sans-serif" font-size="16" font-weight="500" letter-spacing="2" fill="#ff5b8a" text-anchor="middle">MOCK ASSET</text>
  </g>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const BUILD_WALKTHROUGH: StageAsset = {
  id: 'ai-agent-build-walkthrough',
  type: 'walkthrough',
  title: 'Building the AI agent, step by step',
  steps: [
    {
      imageUrl: placeholderImage('Agent definition', 'Persona and rails, no dialogue tree'),
      caption: 'The agent definition. Persona and rails, not a dialogue tree.',
      hotspot: { x: 0.08, y: 0.18, w: 0.36, h: 0.16 },
    },
    {
      imageUrl: placeholderImage('Tool definitions', 'The model chooses which to call'),
      caption: 'The tools available to the agent. The model chooses which to call at runtime.',
      hotspot: { x: 0.54, y: 0.3, w: 0.32, h: 0.26 },
    },
    {
      imageUrl: placeholderImage('Escalation rule', 'Deterministic, not model-dependent'),
      caption: 'The escalation rule. Deterministic, deliberately not left to the model.',
    },
  ],
}

const ARCHITECTURE_DIAGRAM: StageAsset = {
  id: 'digital-room-architecture',
  type: 'diagram',
  title: 'How the pieces fit together',
  src: placeholderImage('Platform architecture', 'Channels, agent, knowledge, routing, analytics'),
}

export interface ScriptedStep {
  delayMs: number
  message: InboundMessage
}

export interface ScriptedTurn {
  id: string
  match: RegExp
  steps: ScriptedStep[]
}

export const GREETING: ScriptedStep[] = [
  {
    delayMs: 400,
    message: {
      text: "Welcome to the Digital Room. Ask me about CXone or Cognigy and I'll show you rather than describe it.\n\nWhat would you like to see?",
      data: {
        _showroom: {
          v: 1,
          action: 'clear',
          cta: [
            { label: 'Helping agents', value: 'How do you help agents during a conversation?', kind: 'quick_reply' },
            { label: 'Supervisors', value: 'What does the supervisor experience look like?', kind: 'quick_reply' },
            { label: 'Outbound', value: 'How does outbound engagement work?', kind: 'quick_reply' },
            { label: 'Show me everything', value: 'Give me the guided tour', kind: 'quick_reply' },
          ],
        },
      },
    },
  },
]

export const SCRIPT: ScriptedTurn[] = [
  {
    id: 'copilot',
    match: /copilot|agent assist|help.*agent|agent.*help|productiv|summar|during a (call|conversation)/i,
    steps: [
      {
        delayMs: 700,
        message: {
          text: "Here's Agent Copilot, about a minute and a half. It's a life insurance application on a live call. I'll talk you through it as it plays.",
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: COPILOT,
              cta: [
                { label: 'Now the supervisor side', value: 'What does the supervisor experience look like?', kind: 'next_asset' },
                { label: 'How is it built?', value: 'How do I actually build an AI agent?', kind: 'quick_reply' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'supervisor',
    match: /supervis|coach|monitor|team (lead|performance)|clarity|control/i,
    steps: [
      {
        delayMs: 700,
        message: {
          text: "The supervisor view, a little over two minutes. The interesting part is that it treats AI agents as team members you can measure and coach.",
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: SUPERVISOR,
              cta: [
                { label: 'Outbound next', value: 'How does outbound engagement work?', kind: 'next_asset' },
                { label: 'Skip ahead', value: 'Skip to the middle', kind: 'quick_reply' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'outbound',
    match: /outbound|dial|campaign|complian|outreach|proactive|tcpa|consent/i,
    steps: [
      {
        delayMs: 700,
        message: {
          text: "Outbound, framed around compliance. Just under three minutes, and the last third shows the AI agent itself being built in Cognigy.",
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: OUTBOUND,
              cta: [
                { label: 'Helping agents', value: 'How do you help agents during a conversation?', kind: 'next_asset' },
                { label: 'Talk to someone', value: 'Can I talk to someone technical?', kind: 'handoff' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'seek-demo',
    match: /skip (ahead|to)|jump to|halfway|middle|fast forward/i,
    steps: [
      {
        delayMs: 400,
        message: {
          text: 'Jumping ahead.',
          data: { _showroom: { v: 1, action: 'seek', position: 60 } },
        },
      },
    ],
  },
  {
    id: 'build',
    match: /build|configur|how do i (make|create)|develop|set.?up|tool|flow/i,
    steps: [
      {
        delayMs: 700,
        message: {
          text: 'This one is a placeholder walkthrough, not a real asset yet. It is here to show how click-through content behaves.',
          data: {
            _showroom: {
              v: 1,
              action: 'show',
              asset: BUILD_WALKTHROUGH,
              cta: [
                { label: 'Show the architecture', value: 'How does this integrate with my stack?', kind: 'next_asset' },
                { label: 'Talk to an engineer', value: 'Can I talk to someone technical?', kind: 'handoff' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'architecture',
    match: /architect|integrat|api|stack|connect|crm|diagram/i,
    steps: [
      {
        delayMs: 700,
        message: {
          text: 'Also a placeholder, standing in for a real architecture diagram.',
          data: {
            _showroom: {
              v: 1,
              action: 'show',
              asset: ARCHITECTURE_DIAGRAM,
              cta: [
                { label: 'Take the full tour', value: 'Give me the guided tour', kind: 'quick_reply' },
                { label: 'Talk to an engineer', value: 'Can I talk to someone technical?', kind: 'handoff' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'tour',
    match: /tour|walk me through|guided|everything|all of it|overview/i,
    steps: [
      {
        delayMs: 600,
        message: {
          text: 'Three videos, about six minutes total. Agents first, then supervisors, then outbound.\n\nStep one.',
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: COPILOT,
              tour: { id: 'three-pillars', title: 'Agents, supervisors, outbound', step: 1, totalSteps: 3 },
              cta: [
                { label: 'Next step', value: 'What does the supervisor experience look like?', kind: 'tour_next' },
                { label: 'Leave the tour', value: 'Let me ask something else', kind: 'quick_reply' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'pricing-rail',
    match: /pric|cost|licen|discount|budget|how much|quote/i,
    steps: [
      {
        delayMs: 550,
        message: {
          text: "I don't handle pricing, and I'd rather not guess at it. That one needs a person who can look at your actual volumes and contract shape.\n\nWant me to set that up? I can pass along what you've looked at here so you don't start from scratch.",
          data: {
            _showroom: {
              v: 1,
              action: 'clear',
              cta: [
                { label: 'Yes, connect me', value: 'Yes please connect me with someone', kind: 'handoff' },
                { label: 'Not yet', value: 'Not yet, let me keep looking', kind: 'quick_reply' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'handoff',
    match: /talk to (someone|a human|an engineer)|connect me|contact|meeting|demo with/i,
    steps: [
      {
        delayMs: 550,
        message: {
          text: "Happy to. In mock mode I can't actually route you, but in the live version this hands over to a Solutions Engineer inside CXone Digital, carrying the transcript and everything you've viewed.\n\nThe tool demonstrating its own escalation path is somewhat the point.",
          data: { _showroom: { v: 1, action: 'clear' } },
        },
      },
    ],
  },
]

export const FALLBACK: ScriptedStep[] = [
  {
    delayMs: 600,
    message: {
      text: 'Mock mode only recognises a handful of topics, so that one falls through. The live agent handles open questions properly.\n\nTry one of these:',
      data: {
        _showroom: {
          v: 1,
          action: 'clear',
          cta: [
            { label: 'Helping agents', value: 'How do you help agents during a conversation?', kind: 'quick_reply' },
            { label: 'Supervisors', value: 'What does the supervisor experience look like?', kind: 'quick_reply' },
            { label: 'Outbound', value: 'How does outbound engagement work?', kind: 'quick_reply' },
            { label: 'Ask for pricing', value: 'How much does it cost?', kind: 'quick_reply' },
          ],
        },
      },
    },
  },
]
