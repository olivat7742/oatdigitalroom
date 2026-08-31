#!/usr/bin/env node
/**
 * Generates catalog/demo-catalog.json from the media directory plus the metadata table below.
 *
 *   node tools/build-catalog.mjs
 *   node tools/build-catalog.mjs --media "D:\\some\\other\\Resources"
 *
 * Why generate rather than hand-write: several filenames carry irregular whitespace, including
 * a trailing space before the extension and doubled spaces mid-title. Hand-encoding thirty of
 * those into URLs is a guaranteed source of silent 404s. This reads the real bytes on disk and
 * encodes the real names.
 *
 * Idempotent and additive. Chapters, talkingPoints, followUps, industries and review fields on
 * existing entries are carried over from the current catalog, so regenerating never destroys
 * hand-authored work. Duplicate files are detected by size and skipped with a warning.
 *
 * No dependencies, so it runs on a machine with nothing installed.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const catalogPath = path.join(repoRoot, 'catalog', 'demo-catalog.json')

const mediaArgIndex = process.argv.indexOf('--media')
const MEDIA_DIR =
  mediaArgIndex !== -1 && process.argv[mediaArgIndex + 1]
    ? path.resolve(process.argv[mediaArgIndex + 1])
    : path.resolve(repoRoot, '..', 'Resources')

/**
 * NiCE World 2026 conference sessions unless noted. Summaries are derived from the title card
 * and filename, not from watching the whole session, and say so in the catalog notes.
 *
 * `skip: true` marks a byte-identical duplicate of another entry.
 */
const META = {
  // The three originals. Their chapters, talk tracks and talking points are hand-authored and
  // live in the catalog, not here; this script carries them over on regeneration.
  'NiCE Copilot for Agents- Every Agent, Elevated.mp4': {
    id: 'nice-copilot-for-agents',
    title: 'CXone Agent Copilot',
    summary:
      'A human agent handles a life insurance application on a live voice call while Agent Copilot works alongside them: summarising the customer journey, flagging missing health questions, confirming identity checks, creating the application in Salesforce, requesting the physician statement, and drafting the reply for the agent to review.',
    products: ['CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['agent assist', 'agent productivity', 'application handling', 'CRM automation', 'insurance new business'],
    personas: ['cx-leader', 'agent-supervisor', 'contact-center-ops'],
    depth: 'functional',
    industries: ['insurance', 'financial services'],
    keywords: ['copilot', 'agent assist', 'agent productivity', 'summarisation', 'salesforce', 'docusign', 'e-signature', 'underwriting', 'insurance', 'app space', 'agent workspace', 'during a call'],
  },
  'Outbound Engagement- Confident Outreach Starts with Compliance.mp4': {
    id: 'outbound-engagement-compliance',
    title: 'Proactive Outreach and outbound compliance',
    summary:
      'How compliance is enforced across an outbound programme, shown in the SmartReach admin: per-state calling windows, do-not-dial and do-not-leave-message settings, contact frequency rules such as one call per seven days in New York with lockout periods, and campaign segmentation. The last third shows the outbound voice AI agent being built and live test-called in Cognigy.',
    products: ['NiCE Proactive Outreach', 'SmartReach', 'Cognigy AI Agents'],
    useCases: ['outbound campaigns', 'proactive engagement', 'compliance', 'contact strategy', 'outbound voice AI'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect', 'procurement'],
    depth: 'technical',
    industries: ['financial services', 'collections', 'insurance', 'utilities'],
    keywords: ['outbound', 'dialer', 'dialler', 'campaign', 'compliance', 'tcpa', 'consent', 'do not call', 'dnc', 'calling window', 'lockout', 'segmentation', 'smartreach', 'cognigy', 'outbound voice bot'],
  },
  'Supervisor- Control, Clarity, and Coaching—All in One.mp4': {
    id: 'supervisor-control-clarity-coaching',
    title: 'Supervisor Workspace, managing human and AI agents',
    summary:
      'The supervisor experience for a mixed workforce of human and AI agents. An AI Agents view lists each bot like a team member with containment, quality score, sentiment and escalation rate, and flags conversations needing attention with the detected reason. Then live monitoring of a single conversation with transcript and generated summary, queue and SLA views, and reskill recommendations naming specific agents to activate when an SLA is at risk.',
    products: ['CXone Supervisor Workspace'],
    useCases: ['supervisor experience', 'AI agent supervision', 'coaching', 'real-time monitoring', 'SLA management', 'workforce reskilling'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    keywords: ['supervisor', 'coaching', 'monitoring', 'live monitoring', 'sla', 'reskill', 'ai agent management', 'bot performance', 'containment rate', 'quality score', 'sentiment', 'escalation'],
  },

  'Accelerate the Benefits of AI CX with Value Realization Services.mp4': {
    id: 'value-realization-services',
    title: 'Value Realization Services',
    summary:
      'Short marketing piece for NiCE VRS, framed around accelerating the benefits once AI CX is already live. Not a conference session and not a product walkthrough.',
    products: ['NiCE Value Realization Services'],
    useCases: ['adoption', 'value realization', 'professional services'],
    personas: ['cx-leader', 'procurement'],
    depth: 'overview',
    keywords: ['vrs', 'value realization', 'roi', 'benefits', 'adoption', 'services', 'time to value'],
  },
  'Agent Augmentation - Human and AI Agents, Truly Collaborating .mp4': {
    id: 'agent-augmentation-copilot',
    title: 'Agent Augmentation: Human and AI Agents Truly Collaborating',
    summary:
      'Session on Copilot for Agents and how human agents and AI agents share work rather than compete for it.',
    products: ['CXone Agent Copilot'],
    useCases: ['agent assist', 'agent productivity', 'human and AI collaboration'],
    personas: ['cx-leader', 'agent-supervisor', 'contact-center-ops'],
    depth: 'functional',
    keywords: ['copilot', 'augmentation', 'collaborating', 'agent assist', 'human in the loop'],
  },
  'Agentic AI Across the Entire CX Journey, on One Platform.mp4': {
    id: 'agentic-ai-one-platform',
    title: 'Agentic AI Across the Entire CX Journey, on One Platform',
    summary:
      'Platform-level session on applying agentic AI across the whole customer journey rather than in isolated point solutions.',
    products: ['CXone Mpower', 'Cognigy AI Agents'],
    useCases: ['platform strategy', 'agentic AI', 'end to end journey'],
    personas: ['cx-leader', 'it-architect'],
    depth: 'overview',
    keywords: ['agentic', 'one platform', 'journey', 'end to end', 'strategy', 'consolidation'],
  },
  'AI Agents - Build With Ease. Deliver at Scale..mp4': {
    id: 'ai-agents-build-deliver-at-scale',
    title: 'AI Agents: Build with Ease, Deliver at Scale',
    summary:
      'The longest session in the set, on building AI agents and operating them at scale. Presented by Shelby Sparrow.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['agentic design', 'build experience', 'scaling', 'tooling'],
    personas: ['it-architect', 'developer', 'contact-center-ops'],
    depth: 'technical',
    keywords: ['build', 'builder', 'scale', 'deliver', 'agent design', 'tooling', 'lifecycle', 'how to build'],
  },
  'AI Agents for Financial Services -  Secure, Trust-Building Experiences.mp4': {
    id: 'ai-agents-financial-services',
    title: 'AI Agents for Financial Services',
    summary:
      'Industry session on AI agents in financial services, framed around security and building customer trust.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['industry use cases', 'security', 'trust', 'authentication'],
    personas: ['cx-leader', 'it-architect', 'procurement'],
    depth: 'functional',
    industries: ['financial services', 'banking', 'insurance'],
    keywords: ['financial services', 'banking', 'finance', 'secure', 'trust', 'fraud', 'authentication', 'regulated'],
  },
  'AI Agents for Healthcare -Patient-Centered Experiences.mov': {
    id: 'ai-agents-healthcare',
    title: 'AI Agents for Healthcare',
    summary: 'Industry session on AI agents in healthcare, framed around patient-centered experiences.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['industry use cases', 'patient experience'],
    personas: ['cx-leader', 'contact-center-ops'],
    depth: 'functional',
    industries: ['healthcare'],
    keywords: ['healthcare', 'patient', 'hipaa', 'clinical', 'appointment', 'provider', 'payer'],
  },
  'AI Agents for Retail - Personalized Buying Experiences .mp4': {
    id: 'ai-agents-retail',
    title: 'AI Agents for Retail',
    summary: 'Industry session on AI agents in retail, framed around personalized buying experiences.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['industry use cases', 'personalization', 'commerce'],
    personas: ['cx-leader', 'contact-center-ops'],
    depth: 'functional',
    industries: ['retail', 'ecommerce'],
    keywords: ['retail', 'shopping', 'buying', 'personalized', 'order', 'returns', 'ecommerce', 'commerce'],
  },
  'AI Agents for Telecom - Resolve Complex Service Needs with Speed and Precision.mp4': {
    id: 'ai-agents-telecom',
    title: 'AI Agents for Telecom',
    summary:
      'Industry session on AI agents in telecom, framed around resolving complex service needs quickly and precisely.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['industry use cases', 'complex service resolution', 'troubleshooting'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect'],
    depth: 'functional',
    industries: ['telecom', 'utilities'],
    keywords: ['telecom', 'telco', 'service', 'complex', 'troubleshoot', 'provisioning', 'outage', 'broadband'],
  },
  'AI Agents for Travel - Elevate Every Moment of the Journey .mp4': {
    id: 'ai-agents-travel',
    title: 'AI Agents for Travel',
    summary: 'Industry session on AI agents in travel, framed around the whole traveller journey.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['industry use cases', 'traveller experience', 'disruption handling'],
    personas: ['cx-leader', 'contact-center-ops'],
    depth: 'functional',
    industries: ['travel', 'airlines', 'hospitality'],
    keywords: ['travel', 'airline', 'hotel', 'booking', 'itinerary', 'disruption', 'rebooking', 'journey'],
  },
  'Ask anything, uncover insights, and take action in real time.mov': {
    id: 'ask-anything-real-time-insights',
    title: 'Ask Anything: Insights and Action in Real Time',
    summary:
      'Session on querying interaction data conversationally to uncover insights and act on them in real time.',
    products: ['CXone Interaction Analytics', 'CXone Mpower'],
    useCases: ['analytics', 'conversational insights', 'real-time action'],
    personas: ['cx-leader', 'agent-supervisor', 'contact-center-ops'],
    depth: 'functional',
    keywords: ['ask anything', 'insights', 'analytics', 'real time', 'query', 'reporting', 'natural language'],
  },
  'Copilot for Workforce Managers Close Coverage Gaps Automatically.mp4': {
    id: 'copilot-workforce-managers',
    title: 'Copilot for Workforce Managers',
    summary: 'Session on closing staffing coverage gaps automatically, aimed at workforce managers.',
    products: ['CXone Workforce Management', 'CXone Copilot'],
    useCases: ['workforce management', 'forecasting', 'scheduling', 'coverage gaps'],
    personas: ['agent-supervisor', 'contact-center-ops'],
    depth: 'functional',
    keywords: ['wfm', 'workforce', 'scheduling', 'forecast', 'coverage', 'shrinkage', 'staffing', 'shifts'],
  },
  'Everything Agents Need in One Workspace .mp4': {
    id: 'agent-workspace',
    title: 'Everything Agents Need in One Workspace',
    summary: 'Session on the unified agent workspace and consolidating what an agent needs into one screen.',
    products: ['CXone Agent Workspace'],
    useCases: ['agent experience', 'desktop consolidation', 'productivity'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    keywords: ['workspace', 'desktop', 'agent experience', 'one screen', 'consolidation', 'swivel chair'],
  },
  'Fewer Transfers, Faster Resolutions, Smarter Routing.mp4': {
    id: 'smarter-routing-fewer-transfers',
    title: 'Fewer Transfers, Faster Resolutions, Smarter Routing',
    summary: 'Session on routing, framed around cutting transfers and resolving faster.',
    products: ['CXone Routing', 'CXone Mpower'],
    useCases: ['omnichannel routing', 'transfer reduction', 'first contact resolution'],
    personas: ['contact-center-ops', 'cx-leader', 'it-architect'],
    depth: 'functional',
    keywords: ['routing', 'transfers', 'resolution', 'fcr', 'skills', 'acd', 'queue', 'escalation'],
  },
  'From AI Generated Data to Automated Actions with Analytics.mp4': {
    id: 'analytics-to-automated-actions',
    title: 'From AI Generated Data to Automated Actions',
    summary: 'Session on turning analytics output into automated action rather than a report nobody reads.',
    products: ['CXone Interaction Analytics', 'CXone Mpower'],
    useCases: ['analytics', 'automation', 'closed loop improvement'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect'],
    depth: 'functional',
    keywords: ['analytics', 'automated actions', 'insights', 'closed loop', 'data', 'automation', 'reporting'],
  },
  'How Supervisors Manage Human and AI Agents Together.mp4': {
    id: 'supervisors-manage-human-and-ai',
    title: 'How Supervisors Manage Human and AI Agents Together',
    summary:
      'Longer session on the supervisor role for a mixed human and AI workforce. Complements the short Supervisor Workspace demo.',
    products: ['CXone Supervisor Workspace'],
    useCases: ['supervisor experience', 'AI agent supervision', 'coaching'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    keywords: ['supervisor', 'manage', 'human and ai', 'mixed team', 'coaching', 'oversight', 'bot management'],
  },
  'How Unified Data Turns Interactions into Swifter, Smarter Actions .mp4': {
    id: 'unified-data-smarter-actions',
    title: 'How Unified Data Turns Interactions into Smarter Actions',
    summary: 'Session on unifying interaction data across channels as the foundation for acting on it.',
    products: ['CXone Mpower'],
    useCases: ['data unification', 'analytics', 'platform architecture'],
    personas: ['it-architect', 'cx-leader'],
    depth: 'technical',
    keywords: ['unified data', 'data model', 'single source', 'integration', 'interactions', 'architecture'],
  },
  'Manage the Hybrid Workforce From Individual to Systemic Performance.mp4': {
    id: 'hybrid-workforce-performance',
    title: 'Managing the Hybrid Workforce',
    summary:
      'Short session on moving from individual agent performance to systemic performance across a hybrid human and AI workforce.',
    products: ['CXone Workforce Management', 'CXone Performance Management'],
    useCases: ['workforce management', 'performance management', 'hybrid workforce'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'overview',
    keywords: ['hybrid workforce', 'performance', 'systemic', 'individual', 'wfm', 'productivity', 'management'],
  },
  'NiCE Performance Management  Demo.mp4': {
    id: 'performance-management-demo',
    title: 'Performance Management',
    summary:
      'A product demo structured as a day in the life. A per-agent metrics table colour-coded on handle time, sales, active time and AI usage; the manager dashboard with handled calls, AI usage and Salesforce case volumes; the agent\'s own view of their numbers; KPI trends with coaching events marked against them; and the configuration behind it, including agent skills and CRM data sources.',
    products: ['CXone Performance Management'],
    useCases: ['performance management', 'coaching', 'agent scorecards', 'KPI reporting', 'AI adoption tracking'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    chapters: [
      {
        t: 0,
        label: 'A day in the life',
        talkTrack:
          'It is framed as a day in the life rather than a feature tour, which makes it easier to follow if you are not already living in these dashboards.',
      },
      {
        t: 25,
        label: 'Per-agent metrics at a glance',
        talkTrack:
          'Every agent on one screen: handle time, sales, active time, and AI usage. The colour coding is the point, you are looking for the red cells rather than reading twenty rows.',
      },
      {
        t: 65,
        label: 'The manager dashboard',
        talkTrack:
          'The manager view pulls in handled volume, AI usage, and Salesforce case counts side by side. Note that AI adoption is tracked as a metric in its own right.',
      },
      {
        t: 115,
        label: "The agent's own view",
        talkTrack:
          'This is the part people forget to ask about. The agent sees their own numbers, so performance management is not something done to them out of sight.',
      },
      {
        t: 175,
        label: 'KPI trends and coaching events',
        talkTrack:
          'Here is where it earns its keep. Individual trends against the team, with coaching events marked on the same timeline, so you can see whether coaching actually moved anything.',
      },
      {
        t: 250,
        label: 'Configuration and data sources',
        talkTrack:
          'Briefly under the hood: agent skills, and the CRM connections feeding it. Worth noting for whoever will ask where the data comes from.',
      },
    ],
    talkingPoints: [
      'Structured as a day in the life across manager and agent roles rather than as a feature tour',
      'Per-agent metrics include AI usage alongside traditional measures like handle time and active time',
      'Agents can see their own performance, not just their supervisor',
      'Coaching events are plotted against KPI trends, so the effect of coaching is visible',
      'Shows CRM data sources including Salesforce, and ServiceNow case counts on the dashboard',
      'All figures and agent names on screen are demo data, not a customer benchmark',
    ],
    keywords: ['performance management', 'kpi', 'scorecard', 'coaching', 'metrics', 'handle time', 'aht', 'ai usage', 'ai adoption', 'dashboard', 'agent performance', 'salesforce', 'servicenow', 'day in the life', 'trends'],
  },
  'Multimodal Experiences - Move with Customers Across Every Channel.mp4': {
    id: 'multimodal-experiences',
    title: 'Multimodal Experiences Across Every Channel',
    summary:
      'Session on carrying a conversation across channels and modalities without the customer starting over.',
    products: ['CXone Digital', 'Cognigy AI Agents'],
    useCases: ['omnichannel', 'multimodal', 'channel switching'],
    personas: ['cx-leader', 'it-architect', 'contact-center-ops'],
    depth: 'functional',
    keywords: ['multimodal', 'omnichannel', 'channels', 'voice', 'chat', 'sms', 'whatsapp', 'channel switch'],
  },
  'Orchestrating Customer Journeys from Intent to Outcome.mp4': {
    id: 'orchestrating-customer-journeys',
    title: 'Orchestrating Customer Journeys from Intent to Outcome',
    summary: 'Long session on journey orchestration, from detecting intent through to a completed outcome.',
    products: ['CXone Mpower', 'Cognigy AI Agents'],
    useCases: ['journey orchestration', 'intent', 'outcome management'],
    personas: ['cx-leader', 'it-architect'],
    depth: 'technical',
    keywords: ['orchestration', 'journey', 'intent', 'outcome', 'workflow', 'process', 'end to end'],
  },
  'Quality Auto Scoring and GenAI Evaluation at Scale.mp4': {
    id: 'quality-auto-scoring-genai',
    title: 'Quality Auto Scoring and GenAI Evaluation at Scale',
    summary:
      'Session on automating quality management: scoring every interaction and evaluating with generative AI rather than sampling.',
    products: ['CXone Quality Management', 'CXone Interaction Analytics'],
    useCases: ['quality management', 'auto scoring', 'evaluation', 'compliance'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    keywords: ['quality', 'qm', 'auto scoring', 'evaluation', 'genai', 'scorecard', 'sampling', 'calibration'],
  },
  'Resolve Problems Before They Arise with Proactive AI Agents .mov': {
    id: 'proactive-ai-agents',
    title: 'Resolve Problems Before They Arise with Proactive AI Agents',
    summary: 'Session on proactive engagement: reaching customers before they have to contact you.',
    products: ['NiCE Proactive Outreach', 'Cognigy AI Agents'],
    useCases: ['proactive engagement', 'deflection', 'outbound'],
    personas: ['cx-leader', 'contact-center-ops'],
    depth: 'functional',
    keywords: ['proactive', 'prevent', 'before', 'anticipate', 'outreach', 'notification', 'deflection'],
  },
  'Screen Intelligence - Fuel CX AI beyond transcripts.mp4': {
    id: 'screen-intelligence',
    title: 'Screen Intelligence: Beyond Transcripts',
    summary:
      'Session on using what happens on the agent desktop, not just the conversation transcript, as a signal for CX AI.',
    products: ['CXone Screen Intelligence', 'CXone Interaction Analytics'],
    useCases: ['desktop analytics', 'process discovery', 'automation opportunities'],
    personas: ['contact-center-ops', 'it-architect', 'cx-leader'],
    depth: 'technical',
    keywords: ['screen', 'desktop', 'transcripts', 'process discovery', 'signals', 'automation opportunity'],
  },
  'Screen Intelligence - Fuel CA AI beyond transcripts.mp4': {
    skip: true,
    duplicateOf: 'screen-intelligence',
    note: 'Byte-identical to the CX-titled file. CA appears to be a typo.',
  },
  'The Agentic Engagement Plane - Execution for AI-first Customer Engagement  .mp4': {
    id: 'agentic-engagement-plane',
    title: 'The Agentic Engagement Plane',
    summary:
      'Architecture session introducing the agentic engagement plane as the execution layer for AI-first customer engagement.',
    products: ['CXone Mpower'],
    useCases: ['platform architecture', 'agentic AI', 'execution layer'],
    personas: ['it-architect', 'developer', 'cx-leader'],
    depth: 'technical',
    keywords: ['engagement plane', 'agentic', 'architecture', 'execution', 'ai-first', 'platform', 'layer'],
  },
  'The Interconnected Agentic World.mov': {
    id: 'interconnected-agentic-world',
    title: 'The Interconnected Agentic World',
    summary:
      'Architecture keynote by Benjamin Mayr, VP and Head of Architecture at NiCE and former Cognigy co-founder, on the platform behind enterprise AI agents and how agentic systems interconnect.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['platform architecture', 'agentic AI', 'interoperability', 'model choice'],
    personas: ['it-architect', 'developer', 'cx-leader'],
    depth: 'technical',
    keywords: ['interconnected', 'agentic', 'architecture', 'keynote', 'mcp', 'interoperability', 'llm', 'model', 'enterprise', 'platform'],
  },
  'MCP - Give Your AI Agents the Tools They Need.mov': {
    skip: true,
    duplicateOf: 'interconnected-agentic-world',
    note: 'Byte-identical to The Interconnected Agentic World. Verified by reading the title card: the content is that keynote, so this filename is wrong.',
  },
  'Turn Outbound into a Predictable Growth Channel.mp4': {
    id: 'outbound-growth-channel',
    title: 'Turn Outbound into a Predictable Growth Channel',
    summary:
      'Session positioning outbound as a revenue channel rather than a cost centre. Complements the outbound compliance demo.',
    products: ['NiCE Proactive Outreach', 'SmartReach'],
    useCases: ['outbound campaigns', 'revenue generation', 'contact strategy'],
    personas: ['cx-leader', 'procurement', 'contact-center-ops'],
    depth: 'overview',
    keywords: ['outbound', 'growth', 'revenue', 'predictable', 'campaign', 'sales', 'collections'],
  },
  'Turning Knowledge into Action - Powering AI with a Single Source of Truth.mp4': {
    id: 'knowledge-single-source-of-truth',
    title: 'Turning Knowledge into Action',
    summary:
      'Session on knowledge management as the grounding layer for AI, with a single source of truth behind both agents and self-service.',
    products: ['CXone Expert', 'Cognigy AI Agents'],
    useCases: ['knowledge management', 'grounding', 'self service', 'RAG'],
    personas: ['it-architect', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    keywords: ['knowledge', 'kb', 'single source of truth', 'grounding', 'rag', 'expert', 'articles', 'hallucination'],
  },
  'Unlock AI Across Any CX Stack Without Replacing Your ACD.mp4': {
    id: 'ai-without-replacing-acd',
    title: 'Unlock AI Across Any CX Stack Without Replacing Your ACD',
    summary:
      'Session on adopting NiCE AI on top of an existing contact centre platform, without a rip-and-replace of the incumbent ACD.',
    products: ['CXone Mpower', 'Cognigy AI Agents'],
    useCases: ['coexistence', 'migration', 'integration', 'incumbent replacement avoidance'],
    personas: ['it-architect', 'procurement', 'cx-leader'],
    depth: 'technical',
    keywords: ['acd', 'existing stack', 'without replacing', 'coexist', 'overlay', 'genesys', 'avaya', 'cisco', 'migration', 'rip and replace'],
  },
}

const MIME_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm'])

function readExisting() {
  try {
    return JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  } catch {
    return { assets: [], tours: [] }
  }
}

const existing = readExisting()
const byId = new Map((existing.assets ?? []).map((a) => [a.id, a]))

/**
 * Durations keyed by exact filename, in seconds.
 *
 * Node has no way to read the duration out of an mp4 or mov without a media library, and this
 * script is deliberately dependency-free. So durations are extracted once by
 * tools/read-durations.ps1 (Windows shell metadata) and committed alongside the catalog.
 */
function readDurations() {
  const p = path.join(repoRoot, 'catalog', 'durations.json')
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}
const DURATIONS = readDurations()

if (!fs.existsSync(MEDIA_DIR)) {
  console.error(`Media directory not found: ${MEDIA_DIR}`)
  console.error('Pass --media <path> or set the videos where the script expects them.')
  process.exit(1)
}

const files = fs
  .readdirSync(MEDIA_DIR)
  .filter((name) => MIME_EXT.has(path.extname(name).toLowerCase()))
  .sort((a, b) => a.localeCompare(b))

const assets = []
const warnings = []
const skipped = []
const missingMeta = []

for (const name of files) {
  const meta = META[name]
  if (!meta) {
    // Hard error, not a warning. A warning here silently dropped three catalogued assets
    // and their hand-authored chapters on the first run of this script.
    missingMeta.push(name)
    continue
  }
  if (meta.skip) {
    skipped.push(`${name} -> duplicate of ${meta.duplicateOf}. ${meta.note ?? ''}`.trim())
    continue
  }

  const full = path.join(MEDIA_DIR, name)
  const stat = fs.statSync(full)
  const prior = byId.get(meta.id) ?? {}

  const asset = {
    id: meta.id,
    title: meta.title,
    summary: prior.summary && prior.reviewedBy && prior.reviewedBy !== 'PLACEHOLDER' ? prior.summary : meta.summary,
    type: 'video',
    approved: prior.approved === true,
    products: meta.products,
    useCases: meta.useCases,
    personas: meta.personas,
    depth: meta.depth,
    ...(meta.industries ? { industries: meta.industries } : {}),
    ...(prior.industries && !meta.industries ? { industries: prior.industries } : {}),
    // Prior wins: a hand-corrected duration should survive regeneration.
    durationSeconds: prior.durationSeconds ?? DURATIONS[name] ?? null,
    source: {
      provider: 'local',
      url: `/media/${encodeURIComponent(name)}`,
      requiresSignedUrl: false,
    },
    // Prior wins over META, so hand-editing the catalog is never silently reverted. META acts
    // as the seed for a newly added asset.
    ...(prior.chapters?.length ? { chapters: prior.chapters } : meta.chapters?.length ? { chapters: meta.chapters } : {}),
    ...(prior.prerequisites?.length ? { prerequisites: prior.prerequisites } : {}),
    ...(prior.followUps?.length ? { followUps: prior.followUps } : {}),
    ...(prior.talkingPoints?.length
      ? { talkingPoints: prior.talkingPoints }
      : meta.talkingPoints?.length
        ? { talkingPoints: meta.talkingPoints }
        : {}),
    keywords: meta.keywords,
    ...(prior.reviewedOn ? { reviewedOn: prior.reviewedOn } : {}),
    ...(prior.reviewedBy ? { reviewedBy: prior.reviewedBy } : {}),
    // Carried through so tooling can see file weight without stat-ing the disk.
    sizeMB: Math.round((stat.size / 1024 / 1024) * 10) / 10,
  }

  if (asset.durationSeconds === null) {
    delete asset.durationSeconds
    warnings.push(`${meta.id}: no durationSeconds. Run tools/probe-durations.mjs output into META or set it manually.`)
  }

  assets.push(asset)
}

// Refuse to write a partial catalog. Writing one would delete the hand-authored chapters of
// any asset whose file is present but unlisted.
if (missingMeta.length) {
  console.error('Refusing to write the catalog: no metadata for these media files.\n')
  for (const name of missingMeta) console.error(`  - ${name}`)
  console.error('\nAdd each to META in tools/build-catalog.mjs, then re-run.')
  process.exit(1)
}

const out = {
  version: '0.4.0',
  updated: process.env['CATALOG_DATE'] ?? new Date().toISOString().slice(0, 10),
  notes:
    'GENERATED by tools/build-catalog.mjs. Do not hand-edit source.url or ids; edit META in the script and regenerate. Chapters, talkingPoints and review fields ARE hand-authored and are carried over on regeneration. Most entries are NiCE World 2026 conference sessions, and their summaries are derived from the title card and filename rather than from watching the full session. Every asset is approved:false until a named human clears it for external use.',
  assets,
  tours: existing.tours ?? [],
}

fs.writeFileSync(catalogPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8')

console.log(`Wrote ${assets.length} assets to catalog/demo-catalog.json`)
console.log(`Media dir: ${MEDIA_DIR}`)
if (skipped.length) {
  console.log('\nSkipped duplicates:')
  for (const s of skipped) console.log(`  - ${s}`)
}
if (warnings.length) {
  console.log('\nWarnings:')
  for (const w of warnings) console.log(`  ! ${w}`)
}
