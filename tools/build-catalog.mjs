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

/**
 * Curation for the public NiCE YouTube channel, keyed by videoId. Source data comes from
 * catalog/youtube-videos.json (see tools/fetch-youtube.ps1).
 *
 * These differ from the local files in two important ways:
 *
 *  - They are ALREADY PUBLIC on NiCE's official channel, so they are genuinely cleared for
 *    external use. That makes them the only assets that can honestly be approved:true, and the
 *    only ones that work on the public GitHub Pages build.
 *  - They render in an iframe, so the host page cannot read playback position. No chapters, no
 *    talk-track narration, and position is a load-time start offset rather than a live seek.
 *
 * `skip` excludes an asset with the reason. The Digital Room exists to SHOW how the technology
 * works, so analyst and partner interviews and brand advertising are excluded: they are
 * legitimate marketing but they do not demonstrate anything.
 */
const YOUTUBE_META = {
  LcF8JMUi6Kk: {
    id: 'td-bank-engagement-hub',
    title: 'TD Bank on the NiCE Engagement Hub',
    summary:
      'Customer story. TD Bank on their use of the NiCE Engagement Hub. Public customer proof rather than a product walkthrough.',
    products: ['NiCE Engagement Hub'],
    useCases: ['customer story', 'digital engagement', 'proof point'],
    personas: ['cx-leader', 'procurement'],
    depth: 'overview',
    industries: ['financial services', 'banking'],
    keywords: ['td bank', 'customer story', 'case study', 'reference', 'banking', 'engagement hub', 'proof', 'who uses'],
  },
  L_U0XM0Ys88: {
    id: 'hyatt-copilot-search-time',
    title: 'Hyatt: cutting agent search time with AI Copilot',
    summary:
      'Customer story. How Hyatt reduced search time for more than 250 human agents using AI Copilot. Public customer proof.',
    products: ['CXone Agent Copilot'],
    useCases: ['customer story', 'agent assist', 'knowledge search', 'proof point'],
    personas: ['cx-leader', 'agent-supervisor', 'procurement'],
    depth: 'overview',
    industries: ['hospitality', 'travel'],
    keywords: ['hyatt', 'customer story', 'case study', 'reference', 'hospitality', 'hotel', 'copilot', 'search time', 'knowledge', 'proof', 'results'],
  },
  '7jjNtuX_EQ4': {
    id: 'bosch-agentic-ai-scale',
    title: 'Bosch: agentic AI across 90+ agents worldwide',
    summary:
      'Customer story. Bosch running agentic AI across more than 90 agents worldwide. Public customer proof of agentic AI at scale.',
    products: ['Cognigy AI Agents'],
    useCases: ['customer story', 'agentic AI', 'scale', 'proof point'],
    personas: ['cx-leader', 'it-architect', 'procurement'],
    depth: 'overview',
    industries: ['manufacturing', 'automotive'],
    keywords: ['bosch', 'customer story', 'case study', 'reference', 'manufacturing', 'agentic', 'scale', 'worldwide', 'multilingual', 'proof', 'who uses'],
  },
  '4HSUQHW5gBM': {
    id: 'agentic-ai-customer-service',
    title: 'Agentic AI customer service',
    summary:
      'Short public positioning piece on agentic AI in customer service, framed around effortless support and business results.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['self-service automation', 'agentic AI', 'positioning'],
    personas: ['cx-leader'],
    depth: 'overview',
    keywords: ['agentic ai', 'customer service', 'effortless', 'automation', 'self service', 'overview', 'introduction'],
  },
  DIjcwghxVlI: {
    id: 'unified-cx-platform',
    title: 'One connected CX platform',
    summary:
      'Short public positioning piece on avoiding the customer breaking point by unifying CX on one connected system.',
    products: ['CXone Mpower'],
    useCases: ['platform strategy', 'consolidation', 'positioning'],
    personas: ['cx-leader', 'it-architect'],
    depth: 'overview',
    keywords: ['unified', 'one platform', 'consolidation', 'breaking point', 'disconnected', 'point solutions', 'silos'],
  },
  '4Ms9_p7Qflk': {
    id: 'exec-why-cx-goes-ai-first',
    title: 'Scott Russell on why CX is going AI-first',
    summary:
      'One minute of executive perspective from NiCE CEO Scott Russell on why customer experience is becoming AI-first. Opinion and framing, not a demonstration.',
    products: ['CXone Mpower'],
    useCases: ['executive perspective', 'market context', 'positioning'],
    personas: ['cx-leader', 'procurement'],
    depth: 'overview',
    keywords: ['scott russell', 'ceo', 'executive', 'ai-first', 'strategy', 'vision', 'why now', 'market'],
  },
  I0Xjib5lOsA: {
    id: 'exec-scaling-ai',
    title: 'Philipp Heltewig on scaling AI',
    summary:
      'Under a minute of executive perspective from Cognigy co-founder Philipp Heltewig on what it takes to scale AI. Opinion and framing, not a demonstration.',
    products: ['Cognigy AI Agents'],
    useCases: ['executive perspective', 'scaling', 'positioning'],
    personas: ['cx-leader', 'it-architect'],
    depth: 'overview',
    keywords: ['philipp heltewig', 'cognigy', 'founder', 'executive', 'scaling', 'scale', 'vision'],
  },
  mLnDYUTE3vA: {
    id: 'exec-human-and-ai-orchestration',
    title: 'Scott Russell on orchestrating AI and human work',
    summary:
      'One minute of executive perspective on unifying AI and human orchestration in CX. Opinion and framing, not a demonstration.',
    products: ['CXone Mpower'],
    useCases: ['executive perspective', 'human and AI collaboration', 'positioning'],
    personas: ['cx-leader'],
    depth: 'overview',
    keywords: ['scott russell', 'executive', 'orchestration', 'human and ai', 'unified', 'workforce'],
  },

  // Excluded. Legitimate marketing, but they do not show how the technology works.
  VOst6YJO7bc: { skip: true, reason: 'NiCE TV partner interview (Kura, FourNet). Channel marketing, not a demonstration.' },
  BKsKrK1tGa4: { skip: true, reason: 'NiCE TV partner interview (Natilik). Channel marketing, not a demonstration.' },
  OJoS2Xc8kCI: { skip: true, reason: 'NiCE TV analyst interview (TalkingPointz). Analyst opinion, not a demonstration.' },
  nRGlhiHhG1M: { skip: true, reason: 'NiCE TV partner interview (AWS). Channel marketing, not a demonstration.' },
  PMw7bII18w4: { skip: true, reason: 'NiCE TV partner interview (Route 101). Channel marketing, not a demonstration.' },
  At9ewMSpFxw: { skip: true, reason: 'NiCE TV CEO interview at NiCE World London. Overlaps the shorter AI at Scale clips already included.' },
  '3MJfI69Mhs0': { skip: true, reason: 'Kristen Bell brand advertising. Not a demonstration of anything.' },
}

/**
 * Public reference links, keyed by the product names used in the catalog.
 *
 * Every URL here was checked to return 200 before being added. Two plausible-looking guesses
 * (`/products/cxone-mpower-agent`, `/products/ai-customer-service-automation`) turned out to
 * 404, which is why these are verified rather than constructed. A dead link under an agent
 * reply is worse than no link: the visitor bookmarks it and finds nothing later.
 *
 * Re-verify with a HEAD sweep if NiCE reorganises the site.
 */
const PRODUCT_REFERENCES = {
  'CXone Agent Copilot': { label: 'Copilot for Agents', url: 'https://www.nice.com/products/copilot-for-agents' },
  'CXone Agent Workspace': { label: 'Workforce Empowerment', url: 'https://www.nice.com/products/workforce-empowerment' },
  'CXone Supervisor Workspace': { label: 'Workforce Management', url: 'https://www.nice.com/products/workforce-management' },
  'CXone Workforce Management': { label: 'Workforce Management', url: 'https://www.nice.com/products/workforce-management' },
  'CXone Performance Management': { label: 'Performance Management', url: 'https://www.nice.com/products/performance-management' },
  'CXone Quality Management': { label: 'Quality Management', url: 'https://www.nice.com/products/quality-management' },
  'CXone Interaction Analytics': { label: 'Interaction Analytics', url: 'https://www.nice.com/products/interaction-analytics' },
  'CXone Screen Intelligence': { label: 'Interaction Analytics', url: 'https://www.nice.com/products/interaction-analytics' },
  'CXone Routing': { label: 'Omnichannel Routing', url: 'https://www.nice.com/products/omnichannel-routing' },
  'CXone Digital': { label: 'Digital Customer Experience', url: 'https://www.nice.com/products/digital-customer-experience' },
  'CXone Expert': { label: 'Knowledge Management', url: 'https://www.nice.com/products/knowledge-management' },
  'CXone Mpower': { label: 'CXone', url: 'https://www.nice.com/products/cxone' },
  'CXone': { label: 'CXone', url: 'https://www.nice.com/products/cxone' },
  'NiCE Proactive Outreach': { label: 'Proactive Outbound Engagement', url: 'https://www.nice.com/products/proactive-outbound-engagement' },
  SmartReach: { label: 'Proactive Outbound Engagement', url: 'https://www.nice.com/products/proactive-outbound-engagement' },
  'NiCE Engagement Hub': { label: 'Engagement Orchestration', url: 'https://www.nice.com/products/engagement-orchestration' },
  'Cognigy AI Agents': { label: 'AI Agents for Self-Service', url: 'https://www.nice.com/products/ai-agents-for-self-service' },
  'NiCE Value Realization Services': { label: 'NiCE', url: 'https://www.nice.com' },
}

/** Appended to every asset, so a visitor always has somewhere to go for more detail. */
const ALWAYS_REFERENCES = [
  { label: 'NiCE product documentation', url: 'https://help.nice-incontact.com' },
]

/** Added when an asset involves Cognigy, since its developer docs live separately. */
const COGNIGY_REFERENCE = { label: 'Cognigy documentation', url: 'https://docs.cognigy.com' }

function referencesFor(products) {
  const out = []
  const seen = new Set()

  for (const product of products ?? []) {
    const ref = PRODUCT_REFERENCES[product]
    if (ref && !seen.has(ref.url)) {
      seen.add(ref.url)
      out.push(ref)
    }
  }
  if ((products ?? []).some((p) => p.toLowerCase().includes('cognigy')) && !seen.has(COGNIGY_REFERENCE.url)) {
    seen.add(COGNIGY_REFERENCE.url)
    out.push(COGNIGY_REFERENCE)
  }
  for (const ref of ALWAYS_REFERENCES) {
    if (!seen.has(ref.url)) {
      seen.add(ref.url)
      out.push(ref)
    }
  }
  // Three is enough to be useful without turning every reply into a link farm.
  return out.slice(0, 3)
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
    references: prior.references?.length ? prior.references : referencesFor(meta.products),
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

// YouTube assets. Public on NiCE's official channel, so unlike the local files these are
// genuinely cleared for external use and they work on the public Pages build.
function readYouTube() {
  const p = path.join(repoRoot, 'catalog', 'youtube-videos.json')
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

const youtube = readYouTube()
const ytSkipped = []

if (youtube?.videos?.length) {
  for (const video of youtube.videos) {
    const meta = YOUTUBE_META[video.videoId]
    if (!meta) {
      warnings.push(`No YOUTUBE_META for ${video.videoId} "${video.title}". Curate it or mark it skip.`)
      continue
    }
    if (meta.skip) {
      ytSkipped.push(`${video.videoId} "${video.title}" -> ${meta.reason}`)
      continue
    }

    const prior = byId.get(meta.id) ?? {}

    assets.push({
      id: meta.id,
      title: meta.title,
      summary: prior.summary && prior.reviewedBy && prior.reviewedBy !== 'PLACEHOLDER' ? prior.summary : meta.summary,
      type: 'embed',
      // Published publicly by NiCE on their official channel. That act of publishing IS the
      // external-use clearance, which is why these can be approved while the internal masters
      // cannot. Attributed to the channel rather than to a person, so it stays auditable.
      approved: true,
      products: meta.products,
      useCases: meta.useCases,
      personas: meta.personas,
      depth: meta.depth,
      ...(meta.industries ? { industries: meta.industries } : {}),
      durationSeconds: video.lengthSeconds ?? undefined,
      source: {
        provider: 'youtube',
        url: video.embedUrl,
        watchUrl: video.watchUrl,
        thumbnailUrl: video.thumbnailUrl,
        requiresSignedUrl: false,
      },
      ...(prior.followUps?.length ? { followUps: prior.followUps } : {}),
      ...(prior.talkingPoints?.length ? { talkingPoints: prior.talkingPoints } : {}),
      keywords: meta.keywords,
      references: prior.references?.length ? prior.references : referencesFor(meta.products),
      reviewedOn: (youtube.videos[0]?.published ?? '').slice(0, 10) || '2026-08-31',
      reviewedBy: 'Published publicly by NiCE on its official YouTube channel',
    })
  }
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
if (ytSkipped.length) {
  console.log('\nYouTube videos excluded by curation:')
  for (const s of ytSkipped) console.log(`  - ${s}`)
}
if (warnings.length) {
  console.log('\nWarnings:')
  for (const w of warnings) console.log(`  ! ${w}`)
}
