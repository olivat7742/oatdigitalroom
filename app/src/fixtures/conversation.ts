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
import { placeholderImage } from '@/placeholder'

/** Fails loudly at module load if a fixture drifts away from the catalog. */
function asset(id: string): StageAsset {
  const resolved = toStageAsset(id)
  if (!resolved) throw new Error(`Fixture references a missing catalog asset: ${id}`)
  return resolved
}

const COPILOT = asset('nice-copilot-for-agents')
const OUTBOUND = asset('outbound-engagement-compliance')
const SUPERVISOR = asset('supervisor-control-clarity-coaching')

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

/**
 * The five introduction questions, mirroring the QUESTION_PLAN in the Cognigy
 * OAT_DIGITAL_ROOM_store_visitor_profile Code node.
 *
 * Kept deliberately in step with the live agent so the public Pages build does not
 * misrepresent how the real thing opens. If you change the plan in Cognigy, change it here.
 */
export interface OnboardingStep {
  /** Profile keys this answer fills. */
  fields: string[]
  question: string
}

export const ONBOARDING: OnboardingStep[] = [
  { fields: ['firstName', 'lastName'], question: 'To start, what is your name?' },
  { fields: ['company', 'jobTitle'], question: 'Thanks. Where do you work, and what is your role there?' },
  {
    fields: ['email'],
    question:
      'What is your business email? It is so I can follow up, or send you anything you want to keep.',
  },
  { fields: ['department'], question: 'Which department or team is this project for? It need not be your own.' },
  { fields: ['interest'], question: 'Last one. What kind of solution are you looking at, in your own words?' },
]

/**
 * Extra questions asked only of a NiCE employee, spliced in straight after the email answer
 * because that is the moment the domain identifies them.
 *
 * A colleague is not a lead. Running them through the customer script would put NiCE's own
 * logo in the header, and would either find NiCE's own Salesforce account or mark a colleague
 * as a new lead, both of which are noise. So we ask who the session is really for.
 *
 * The website is asked rather than accepted from the company name for the same reason as
 * everywhere else in this project: names repeat across countries and a wrong match here would
 * name the wrong account executive.
 */
export const NICE_EMPLOYEE_BRANCH: OnboardingStep[] = [
  {
    fields: ['niceIntent'],
    question:
      "You're on the NiCE side, so let me ask a different question. Is this for your own knowledge, or are you preparing for a specific customer or prospect?",
  },
]

export const NICE_ON_BEHALF_BRANCH: OnboardingStep[] = [
  {
    fields: ['onBehalfOfCompany', 'onBehalfOfWebsite'],
    question:
      'Which company is it for? Their website is the most useful part, since company names repeat across countries and I would rather not match the wrong account.',
  },
]

export const GREETING: ScriptedStep[] = [
  {
    delayMs: 400,
    message: {
      text: `Welcome to the NiCE Digital Room.\n\nSo I can tailor what I show you rather than guess, I'd like to start with a few quick questions. Nothing long, and the privacy policy is linked below.\n\n${ONBOARDING[0]?.question ?? ''}`,
      data: { _showroom: { v: 1, action: 'clear', cta: [] } },
    },
  },
]

export const SCRIPT: ScriptedTurn[] = [
  // Chapter jumps come FIRST, so a question about a specific moment is not swallowed by the
  // broader topic matchers below. Positions are the real chapter timestamps from the catalog.
  {
    id: 'chapter-reskill',
    match: /reskill|re-?skill|sla.*(risk|breach)|recommend.*(agent|skill)|cover.*skill/i,
    steps: [
      {
        delayMs: 650,
        message: {
          text: 'Jumping to about 1:36, where the reskill recommendations appear. Watch that it names specific agents and gives a reason for each, rather than just raising an alert.',
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: SUPERVISOR,
              position: 96,
              cta: [
                { label: 'Start from the beginning', value: 'What does the supervisor experience look like?', kind: 'quick_reply' },
                { label: 'Which bots are failing?', value: 'How do I find AI agents that are failing?', kind: 'quick_reply' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'chapter-failing-bots',
    match: /failing|fails|loop|underperform|badly|which bot|bad bot|frustrat/i,
    steps: [
      {
        delayMs: 650,
        message: {
          text: 'Straight to 0:48. These are the conversations flagged critical, with the detected reason next to each, including a loop detected in conversation.',
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: SUPERVISOR,
              position: 48,
              cta: [
                { label: 'Then what?', value: 'Jump to the reskill recommendations', kind: 'tour_next' },
                { label: 'Watch one conversation', value: 'Show me live monitoring of a conversation', kind: 'quick_reply' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'chapter-live-monitoring',
    match: /live monitor|monitor.*conversation|transcript|listen in|watch a (call|conversation)/i,
    steps: [
      {
        delayMs: 650,
        message: {
          text: 'Jumping to 1:02. Conversation path on the left, full transcript in the middle, and a generated summary so the supervisor does not have to read it all.',
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: SUPERVISOR,
              position: 62,
              cta: [
                { label: 'Reskilling next', value: 'Jump to the reskill recommendations', kind: 'tour_next' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'chapter-cognigy-build',
    match: /cognigy|voice ai agent|outbound.*(built|build|author)|(built|build).*outbound|grounding|tool call/i,
    steps: [
      {
        delayMs: 650,
        message: {
          text: 'Skipping to 1:55, the part people do not expect in an outbound video. That is the voice AI agent being authored and live test-called, with its instructions, grounding and tool calls visible.',
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: OUTBOUND,
              position: 115,
              cta: [
                { label: 'Back to compliance', value: 'Show me the calling window rules', kind: 'quick_reply' },
                { label: 'Talk to an engineer', value: 'Can I talk to someone technical?', kind: 'handoff' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'chapter-calling-rules',
    match: /calling window|do not (dial|call)|\bdnc\b|per.?state|state.*(rule|law)|frequency|lockout|how often|one call/i,
    steps: [
      {
        delayMs: 650,
        message: {
          text: 'Jumping to 0:35. A real rule: one call per seven days in New York, scoped by channel, with a lockout period. This is usually the screen an auditor actually wants.',
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: OUTBOUND,
              position: 35,
              cta: [
                { label: 'How was the agent built?', value: 'Show me the AI agent being built in Cognigy', kind: 'next_asset' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'chapter-salesforce',
    match: /salesforce|crm record|e-?sign|docusign|application created|identity|verif/i,
    steps: [
      {
        delayMs: 650,
        message: {
          text: 'Jumping to 0:25. Two things land without the agent asking: identity verified, and the application created in Salesforce with an e-signature link already sent.',
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: COPILOT,
              position: 25,
              cta: [
                { label: 'What happens next?', value: 'Show me the drafted reply part', kind: 'tour_next' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'chapter-drafted-reply',
    match: /draft|suggested response|physician|underwrit|write.*(reply|response)/i,
    steps: [
      {
        delayMs: 650,
        message: {
          text: 'Jumping to 0:50. The physician statement has been requested and the reply is drafted. The agent reviews and sends rather than composing from scratch.',
          data: {
            _showroom: {
              v: 1,
              action: 'play',
              asset: COPILOT,
              position: 50,
              cta: [
                { label: 'See it all automated', value: 'Show me the end to end automation summary', kind: 'quick_reply' },
              ],
            },
          },
        },
      },
    ],
  },
  {
    id: 'chapter-end-to-end',
    match: /end.?to.?end|automation summary|what got automated/i,
    steps: [
      {
        delayMs: 650,
        message: {
          text: 'Jumping to 1:12, the recap of what happened in the background: creating the application, collecting the signature, chasing the medical record.',
          data: {
            _showroom: { v: 1, action: 'play', asset: COPILOT, position: 72 },
          },
        },
      },
    ],
  },
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
