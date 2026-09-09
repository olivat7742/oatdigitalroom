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
 * The media directory is walked RECURSIVELY, and META is keyed by the path relative to it with
 * forward slashes, so `NiCE World - Vertical Assets/FSI/Voice_FSI.mp4` is a key. The vertical
 * assets arrived filed into one folder per industry and a flat readdir simply did not see them.
 * app/vite.config.ts already resolves any relative path under the media root, with a traversal
 * guard, so nested paths need nothing on the serving side.
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
 * References an entry in META can cite directly, declared here rather than beside
 * PRODUCT_REFERENCES below because META is evaluated first and a `const` is not readable
 * before its declaration.
 *
 * Every URL here is one NiCE actually publishes. Three of the products in the retail set,
 * AI Studio, Interactions Hub and Actions, have no page under nice.com/products that resolves,
 * so where NiCE has a resource page for one it is cited as itself, and the rest fall back to
 * the product documentation via referencesFor(). Nothing here is a guessed URL:
 * tools/check-links.ps1 fails the build if one rots.
 */
/** Added when an asset involves Cognigy, since its developer docs live separately. */
const COGNIGY_REFERENCE = { label: 'Cognigy documentation', url: 'https://docs.cognigy.com' }
/** NiCE's own retail datasheet. Cited by the whole retail set, which is one vertical scenario. */
const RETAIL_REFERENCE = { label: 'CXone for Retail', url: 'https://www.nice.com/resources/cxone-for-retail' }
const SUPERVISOR_COPILOT_REFERENCE = {
  label: 'NiCE Copilot for Supervisors',
  url: 'https://www.nice.com/resources/nice-copilot-for-supervisors-multiply-supervisors-business-impact',
}
const INTERACTIONS_HUB_REFERENCE = {
  label: 'CXone Interactions Hub',
  url: 'https://www.nice.com/resources/cxone-interactions-hub',
}

/**
 * Industry landing pages, for the NiCE World vertical demos. Each of these is a demo of one
 * industry story, so the industry page is better further reading than any single product page.
 * Verified live; nice.com has no utilities or energy page, so those fall back to the products.
 */
const INDUSTRY_REFERENCE = {
  financial: { label: 'NiCE for Financial Services', url: 'https://www.nice.com/industries/financial-services' },
  healthcare: { label: 'NiCE for Healthcare', url: 'https://www.nice.com/industries/healthcare' },
  government: { label: 'NiCE for Government', url: 'https://www.nice.com/industries/government' },
  telecom: { label: 'NiCE for Telecommunications', url: 'https://www.nice.com/industries/telecommunications' },
}

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

  // ----------------------------------------------------------------------------------------
  // The Retail set, plus NiCE Homes. Different in kind from the conference sessions above.
  //
  // These are scenario demos on a fictional brand, "NiCE Retail", a luxury fashion
  // e-commerce site with Women's, Men's and Accessories collections. One shopper journey is
  // carried across the platform product by product, in a sequence the vendor numbered 1 to 8,
  // wrapped by two long end-to-end cuts and three shorter single-topic ones. The numbering is
  // the intended watch order, so it stays visible in the titles.
  //
  // These summaries WERE checked against the recordings, by extracting frames with ffmpeg.
  // Two things that came out of doing so and that shape every entry below:
  //
  //  1. All eight numbered clips are SILENT. The audio stream is present but digitally empty
  //     at -91 dB. Instead of a voice over they carry burned-in narration captions in a band
  //     across the bottom of the frame. Those captions are NiCE's own claims about the
  //     product, so they are quoted verbatim into `talkingPoints`, which is the field for
  //     claims the agent is allowed to make. `chapters` mark where each one appears, so the
  //     room's talk-track mechanism works on all eight.
  //  2. Clip 8, "CXone Actions", is NOT workflow automation, which is what the filename
  //     suggests and what this table said before anyone watched it. It is unified BI with
  //     natural-language querying, plus Automated Insights spotting automation opportunities
  //     and creating a Cognigy agent from one. Worth knowing before showing it to an
  //     architect who asked about workflow.
  //
  // The quantified claims in `talkingPoints` below (15-25% AHT, 100% coverage versus 1-3%)
  // are NiCE's own on-screen wording, transcribed rather than invented. They are still
  // marketing claims on an asset that is `approved: false`, so see catalog/chapters-todo.md
  // before turning that flag over.
  // ----------------------------------------------------------------------------------------

  '1 - NiCE Retail - NiCE Cognigy.mp4': {
    id: 'retail-1-cognigy-ai-agent',
    title: 'Retail 1: Cognigy AI Agent',
    summary:
      'A shopper on a fashion retail site is handled entirely by the Cognigy AI agent in web chat: store opening hours, the returns policy, a product recommendation returned as rich cards with View Details and View Product buttons, adding to cart and buying, and finally a damaged item, which is the point at which the AI decides to hand over to a human. Silent, with narration captions on screen rather than a voice over.',
    products: ['Cognigy AI Agents'],
    useCases: ['self service', 'containment', 'retail customer service', 'conversational AI', 'product recommendation'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE, COGNIGY_REFERENCE],
    chapters: [
      { t: 4, label: 'Opening title', talkTrack: 'This is the first of eight, and it stays entirely on the customer side. Nothing here has reached a human yet.' },
      { t: 22, label: 'Opening hours, answered 24/7', talkTrack: 'A simple question first, deliberately. The point being made is availability: this costs the same at three in the morning as it does at midday.' },
      { t: 49, label: 'Returns policy from the knowledge base', talkTrack: 'The answer is coming out of the knowledge base rather than being generated freely, which is what keeps it on-brand and stops it inventing a policy.' },
      { t: 72, label: 'Several intents in one conversation', talkTrack: 'Watch that the shopper changes subject and the agent follows. Most bots are one question and done, and this is where that difference shows.' },
      { t: 111, label: 'Taking action, not just answering', talkTrack: 'Here it stops talking and starts doing: it is connected to the tools behind the site, so it can complete the task rather than describe it.' },
      { t: 129, label: 'Rich cards and add to cart', talkTrack: 'These product cards are xApps. Self-service does not have to be a wall of text, and for retail that matters more than in most industries.' },
      { t: 164, label: 'Damaged item, and the handover decision', talkTrack: 'And this is the moment worth pausing on. It recognises this one is not for it, and hands over. Knowing when to stop is as important as the containment rate.' },
    ],
    talkingPoints: [
      '24/7 availability with no incremental cost, containment at scale without additional headcount',
      'Knowledge base guardrails ensure accurate, on-brand, compliant responses every time',
      'Agentic AI handles multiple intents within a single conversation, not just one and done',
      'Connected to tools to execute processes end-to-end without human involvement',
      'xApps deliver rich, interactive self-service experiences beyond simple text responses',
      'Intelligent escalation decisions: AI knows when to resolve and when to hand over',
    ],
    keywords: ['retail', 'cognigy', 'ai agent', 'self service', 'bot', 'containment', 'chatbot', 'shopper', 'opening hours', 'returns policy', 'product recommendation', 'add to cart', 'xapps', 'rich cards', 'escalation', 'handover', 'retail series', 'retail 1'],
  },
  '2 - NiCE Retail - NiCE CXone Agent.mp4': {
    id: 'retail-2-cxone-agent',
    title: 'Retail 2: CXone Agent',
    summary:
      'The human agent side of the same retail conversation, in CXone Agent. The agent picks up the escalated shopper with Copilot alongside them in App Space: suggested replies, knowledge, sentiment, and a wrap-up. The claims made on screen are about agent economics, handle time, onboarding time and attrition, rather than about features. Silent, with narration captions on screen.',
    products: ['CXone Agent Workspace', 'CXone Agent Copilot'],
    useCases: ['agent experience', 'agent assist', 'escalation handling', 'onboarding', 'agent retention'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE],
    chapters: [
      { t: 5, label: 'The agent picks up', talkTrack: 'This is the other half of clip one. Same conversation, now on the agent desktop.' },
      { t: 39, label: 'Real-time assistance and auto-wrap', talkTrack: 'The claim on screen is a fifteen to twenty-five percent cut in handle time, and it is coming from two places: help during the call, and the wrap-up being written for them afterwards.' },
      { t: 76, label: 'Onboarding and consistency', talkTrack: 'This is the argument that lands best with anyone running a seasonal operation. New starters reach competency in weeks rather than months, because the guidance is in the tool.' },
      { t: 117, label: 'Agent effort and retention', talkTrack: 'Worth naming the second-order effect: lower cognitive load is a retention argument, not just a productivity one. In retail contact centres attrition is usually the bigger number.' },
      { t: 151, label: 'Sentiment coaching in the moment', talkTrack: 'Coaching arrives while it can still change the outcome, instead of in a review three weeks later.' },
      { t: 184, label: 'Schedule, evaluations and coaching in one place', talkTrack: 'And the agent sees their own schedule, evaluations and coaching here too, so none of it is happening to them out of sight.' },
    ],
    talkingPoints: [
      'Average Handle Time reductions of 15-25% through real-time AI assistance and auto-wrap',
      'Faster agent onboarding: new starters reach competency in weeks, not months, with AI as their guide',
      'Consistent quality across the entire team regardless of tenure or experience level',
      'Reduced agent effort and lower cognitive load translates directly to improved retention',
      'In-the-moment sentiment coaching replaces retrospective feedback, so behaviour changes faster',
      'Agents empowered with visibility of their schedule, evaluations, and coaching in one unified space',
    ],
    keywords: ['retail', 'cxone agent', 'agent desktop', 'workspace', 'copilot', 'agent assist', 'handover', 'escalation', 'aht', 'handle time', 'auto wrap', 'onboarding', 'attrition', 'retention', 'sentiment coaching', 'retail series', 'retail 2'],
  },
  '3 - NiCE Retail - NiCE CXone AI Studio.mp4': {
    id: 'retail-3-cxone-ai-studio',
    title: 'Retail 3: CXone AI Studio',
    summary:
      'The shortest of the eight, and the one aimed at whoever will own the thing after go-live. CXone AI Studio is where the AI behaviour behind the retail scenario is configured, tested against live interactions before release, and kept inside guardrails. The argument is that the business changes it, not the vendor and not a change request to IT. Silent, with narration captions on screen.',
    products: ['CXone AI Studio'],
    useCases: ['agentic design', 'build experience', 'tooling', 'no-code configuration', 'prompt testing', 'AI governance'],
    personas: ['it-architect', 'developer', 'contact-center-ops'],
    depth: 'technical',
    industries: ['retail'],
    references: [RETAIL_REFERENCE],
    chapters: [
      { t: 9, label: 'Business-owned configuration', talkTrack: 'The claim here is ownership. Whoever runs the operation changes the AI, without a vendor ticket and without waiting on an IT release.' },
      { t: 20, label: 'Changing behaviour in minutes', talkTrack: 'This is the one that matters in retail specifically. Promotions and policies change weekly, so the AI has to change on that cadence too.' },
      { t: 29, label: 'Testing prompts against live interactions', talkTrack: 'And this is the safety net. Changes get tested against real interactions before they reach production, which is the answer to the obvious objection about letting the business edit the AI.' },
      { t: 77, label: 'Guardrails and compliance controls', talkTrack: 'Guardrails are configured here rather than hoped for. Useful to note for anyone whose risk function will ask what stops it going off-script.' },
    ],
    talkingPoints: [
      'Business-owned AI configuration: no vendor dependency, no IT bottleneck for updates',
      'Rapid change cycles: update AI behaviour in minutes when policies or products change',
      'Prompt testing against live interactions eliminates risk before changes go into production',
      'Guardrails and compliance controls built in, so AI stays within defined boundaries at all times',
    ],
    keywords: ['retail', 'ai studio', 'build', 'builder', 'configure', 'tooling', 'design', 'low code', 'no code', 'prompt', 'prompt testing', 'guardrails', 'governance', 'change control', 'retail series', 'retail 3'],
  },
  '4 - NiCE Retail - NiCE CXone Supervisor Copilot.mp4': {
    id: 'retail-4-supervisor-copilot',
    title: 'Retail 4: Copilot for Supervisors',
    summary:
      'Ninety seconds on the supervisor layer over the retail operation. Copilot for Supervisors surfaces live sentiment signals so a supervisor can intervene before a poor experience becomes a complaint, whisper-coach an agent mid-conversation, and spend their time developing people instead of listening in. The shortest and most focused of the eight. Silent, with narration captions on screen.',
    products: ['CXone Copilot', 'CXone Supervisor Workspace'],
    useCases: ['supervisor experience', 'coaching', 'real-time monitoring', 'proactive intervention', 'span of control'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE, SUPERVISOR_COPILOT_REFERENCE],
    chapters: [
      { t: 9, label: 'Managing larger teams', talkTrack: 'The headline claim is span of control: more agents per supervisor without losing the quality of oversight.' },
      { t: 19, label: 'Intervening before it becomes a complaint', talkTrack: 'This is the proactive bit. The intervention happens while the conversation is still recoverable, rather than after a complaint arrives.' },
      { t: 28, label: 'Acting on now, not last week', talkTrack: 'Sentiment signals are live. The contrast being drawn is with a report on Monday about what went wrong on Friday.' },
      { t: 38, label: 'Whisper coaching', talkTrack: 'Whisper coaching, in the moment. Same argument as the agent clip, from the other side of the desk.' },
      { t: 50, label: 'Supervisor time redirected', talkTrack: 'And the closing point is where the time goes. Less passive monitoring, more actual development of the team.' },
    ],
    talkingPoints: [
      'Supervisors can effectively manage larger teams without sacrificing quality of oversight',
      'Proactive intervention before a poor customer experience becomes a complaint or churn event',
      "Sentiment signals allow supervisors to act on what's happening now, not what happened last week",
      'Whisper coaching in the moment is more effective than retrospective feedback sessions',
      'Supervisor time reclaimed from passive monitoring and redirected into genuine development activity',
    ],
    keywords: ['retail', 'supervisor', 'copilot', 'coaching', 'whisper coaching', 'monitoring', 'oversight', 'intervention', 'sentiment', 'span of control', 'churn', 'complaint', 'retail series', 'retail 4'],
  },
  '5 - NiCE Retail - NiCE CXone Interactions Hub.mp4': {
    id: 'retail-5-interactions-hub',
    title: 'Retail 5: CXone Interactions Hub',
    summary:
      'Interactions Hub as the single place every retail interaction lands, whatever channel it came in on. Shows synchronised call and screen playback for full context on an interaction, and a quality evaluation triggered in one click straight from playback rather than in a separate tool. The argument is consolidation: one recording estate instead of several. Silent, with narration captions on screen.',
    products: ['CXone Interactions Hub'],
    useCases: ['interaction management', 'recording', 'screen recording', 'search and retrieval', 'compliance', 'consolidation'],
    personas: ['contact-center-ops', 'it-architect', 'agent-supervisor'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE, INTERACTIONS_HUB_REFERENCE],
    chapters: [
      { t: 18, label: 'Every channel in one estate', talkTrack: 'The phrase they use is no dark corners: every channel recorded in one place, which is usually not the starting position.' },
      { t: 37, label: 'Cost of multiple recording systems', talkTrack: 'This is the commercial argument, and it is the one procurement will care about: several disconnected recording systems collapse into one.' },
      { t: 72, label: 'Synchronised call and screen playback', talkTrack: 'Call and screen together. You can see what the agent was actually doing, not just hear what was said, which is often where the real cause is.' },
      { t: 98, label: 'One-click evaluation from playback', talkTrack: 'And the evaluation is triggered from here, in the same screen. No switching tools, no losing your place.' },
    ],
    talkingPoints: [
      'Complete omnichannel visibility: no dark corners in your interaction estate',
      'Significant cost and complexity reduction versus managing multiple disconnected recording systems',
      'Synchronised call and screen playback gives the full context of every agent interaction',
      'One-click QM evaluation triggers directly from playback: no system switching, no lost context',
    ],
    keywords: ['retail', 'interactions hub', 'interaction management', 'recording', 'screen recording', 'playback', 'retention', 'pci', 'redaction', 'search', 'omnichannel', 'consolidation', 'evaluation', 'retail series', 'retail 5'],
  },
  '6 - NiCE Retail - NiCE CXone Quality Management.mp4': {
    id: 'retail-6-quality-management',
    title: 'Retail 6: CXone Quality Management',
    summary:
      'The longest of the eight, on automated quality management for the retail operation. Custom categories and behaviours encode the retailer\'s own standard, AI scores every interaction rather than a sample, prompts are validated against live interactions before deployment, and the QA team moves from manual scoring to exception management and calibration. Carries the strongest quantified claim in the set: 100% coverage against an industry norm of 1-3%. Silent, with narration captions on screen.',
    products: ['CXone Quality Management'],
    useCases: ['quality management', 'evaluation', 'auto scoring', 'calibration', 'coaching', 'compliance'],
    personas: ['agent-supervisor', 'contact-center-ops', 'cx-leader'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE],
    chapters: [
      { t: 53, label: 'Your standard, not a generic one', talkTrack: 'Custom categories and behaviours first. The scoring reflects this retailer\'s standard rather than a template, which is usually the first objection from a QA lead.' },
      { t: 132, label: 'Removing evaluator bias', talkTrack: 'AI scoring takes out evaluator bias and the calibration drift between assessors. Anyone who has run calibration sessions will recognise the problem being solved.' },
      { t: 157, label: 'Validating before deployment', talkTrack: 'Same safety net as AI Studio: the scoring prompts get tested against live interactions before they go live.' },
      { t: 193, label: '100% coverage versus 1-3%', talkTrack: 'This is the number to stop on. Every interaction scored, against an industry norm of one to three percent with manual QA. It changes what quality management is for.' },
      { t: 219, label: 'What the QA team does instead', talkTrack: 'And that is the honest answer to what happens to the QA team: they move to exceptions, calibration and insight, rather than scoring forms all day.' },
    ],
    talkingPoints: [
      'Custom categories, behaviours, and auto-response rules ensure your standard is precisely reflected',
      'AI scoring eliminates evaluator bias and calibration inconsistency across your QA team',
      'Prompt testing against live interactions validates AI accuracy before production deployment',
      '100% interaction coverage versus the industry average of 1-3% with manual QA',
      'QA teams shift from manual scoring to exception management, calibration, and strategic insight',
    ],
    keywords: ['retail', 'quality', 'qm', 'quality management', 'evaluation', 'scorecard', 'auto scoring', 'calibration', 'evaluator bias', 'coverage', 'sampling', 'exception management', 'retail series', 'retail 6'],
  },
  '7 - NiCE Retail - NiCE CXone Interaction Analytics.mp4': {
    id: 'retail-7-interaction-analytics',
    title: 'Retail 7: CXone Interaction Analytics',
    summary:
      'Interaction Analytics across every retail conversation rather than a hand-picked sample. Topic AI categorises automatically, so problems surface that nobody thought to search for; trends and anomalies appear at business speed rather than in a report weeks later; and you can drill from a trend line down to the transcript that caused it. Framed as much for product and marketing teams as for the contact centre. Silent, with narration captions on screen.',
    products: ['CXone Interaction Analytics'],
    useCases: ['analytics', 'conversational insights', 'root cause analysis', 'repeat contact reduction', 'voice of the customer'],
    personas: ['cx-leader', 'contact-center-ops', 'agent-supervisor'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE],
    chapters: [
      { t: 10, label: 'Every conversation, not a sample', talkTrack: 'Topic AI reads all of them. Same coverage argument as quality management, applied to insight rather than scoring.' },
      { t: 20, label: 'Problems you did not know to look for', talkTrack: 'This is the part people underestimate. Automatic categorisation finds the thing you would never have written a search for.' },
      { t: 68, label: 'Trends and anomalies at business speed', talkTrack: 'The contrast being drawn is with a monthly report. For a retailer mid-promotion, weeks later is the same as never.' },
      { t: 76, label: 'Beyond the contact centre', talkTrack: 'Worth flagging who else this is for. Product, operations and marketing get customer intelligence out of it, which is often how the business case gets funded.' },
      { t: 83, label: 'Reducing repeat contacts', talkTrack: 'And the operational payoff: find the underlying cause of contact volume and remove it, rather than staffing up to absorb it.' },
      { t: 111, label: 'Drill from trend to transcript', talkTrack: 'Finally, the drill-through. Trend to transcript in a couple of clicks, so you get the actual cause rather than a metric that moved.' },
    ],
    talkingPoints: [
      '100% interaction coverage: Topic AI analyses every conversation, not a hand-picked sample',
      "Automatic categorisation means you discover problems you didn't know to look for",
      'Trend spotting and anomaly detection at the speed your business needs, not weeks later in a report',
      'Product, operations, and marketing teams gain real customer intelligence to drive business decisions',
      'Reduce repeat contacts by identifying and eliminating the underlying causes of contact volume',
      'Drill-through from trend to transcript gives true root cause, not surface-level metrics',
    ],
    keywords: ['retail', 'interaction analytics', 'analytics', 'insights', 'topic ai', 'sentiment', 'topics', 'drivers', 'reporting', 'root cause', 'repeat contacts', 'anomaly detection', 'voice of the customer', 'retail series', 'retail 7'],
  },
  '8 - NiCE Retail - NiCE CXone Actions.mp4': {
    id: 'retail-8-cxone-actions',
    title: 'Retail 8: CXone Actions',
    summary:
      'The last of the eight, and not what the name suggests: CXone Actions is unified BI across the whole CXone suite, queried in natural language so a business leader can ask a data question without an analyst. Automated Insights then reads real conversation patterns to identify which automation opportunities are actually worth building, sized by volume, and a Cognigy agent can be created from one in a click. Closes the loop from insight to deployed automation. Silent, with narration captions on screen.',
    products: ['CXone Actions', 'Cognigy AI Agents'],
    useCases: ['business intelligence', 'natural language querying', 'automation opportunity sizing', 'closed loop improvement'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect', 'procurement'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE, COGNIGY_REFERENCE],
    chapters: [
      { t: 8, label: 'Unified BI across the suite', talkTrack: 'One place for the whole suite\'s data. If someone has asked how these products report together, this is the answer.' },
      { t: 18, label: 'Asking in natural language', talkTrack: 'And it is queried in plain language, which is the part that takes insight out of the analyst queue and puts it in front of whoever actually owns the number.' },
      { t: 109, label: 'Automated Insights finds the opportunities', talkTrack: 'Now it turns predictive. It reads real conversation patterns and tells you where automation would pay, rather than you guessing.' },
      { t: 120, label: 'Evidence, not gut feel', talkTrack: 'This is the slide to remember for a business case. Automation candidates ranked by evidence and volume, not by whoever argued loudest.' },
      { t: 144, label: 'One click to a Cognigy agent', talkTrack: 'And then it closes the loop: build the Cognigy agent for that opportunity from here. Insight to deployed automation without a project in between.' },
    ],
    talkingPoints: [
      'Unified BI across the entire CXone suite: one place for all your contact centre intelligence',
      'Natural language querying puts data insight in the hands of every business leader, not just analysts',
      'Spot trends, ask data questions in natural language, and zero in on process, CX, and knowledge gaps',
      'Automated Insights identifies automation opportunities using AI analysis of real conversation patterns',
      'Evidence-based automation decisions: not gut feel, but data-driven identification of the right use cases',
      'One-click Cognigy agent creation collapses the time from insight to deployed automation',
    ],
    keywords: ['retail', 'actions', 'cxone actions', 'bi', 'business intelligence', 'reporting', 'natural language query', 'ask a question', 'automated insights', 'automation opportunity', 'business case', 'closed loop', 'one click agent', 'retail series', 'retail 8'],
  },

  'NiCE Retail - NiCE Cognigy and Copilot.mp4': {
    id: 'retail-cognigy-and-copilot',
    title: 'Retail: Cognigy and Copilot together',
    summary:
      'The same retail shopper journey as clips one and two, but run as one continuous six-minute story instead of split by product, and with no captions over it. The chat opens on a video avatar, works through opening hours, the returns policy, a product recommendation and a parka product page, then a damaged item escalates to an agent who has Copilot suggesting replies and a Task Assistant offering appointment booking and a change of address. The best single clip to show if the question is about the handover itself rather than about either product.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['self service', 'agent assist', 'human and AI collaboration', 'escalation handling', 'task automation'],
    personas: ['cx-leader', 'contact-center-ops', 'agent-supervisor'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE, COGNIGY_REFERENCE],
    chapters: [
      { t: 7, label: 'Chat opens on a video avatar', talkTrack: 'Note how the chat opens. There is a presenter-style avatar rather than a text box, which is a choice a retail brand can make about how self-service feels.' },
      { t: 39, label: 'Hours and returns policy', talkTrack: 'The routine questions first: opening hours, then the thirty-day returns policy out of the knowledge base.' },
      { t: 103, label: 'Product recommendation', talkTrack: 'Now it recommends, with product cards rather than a list of links.' },
      { t: 135, label: 'The product page', talkTrack: 'And through to the actual product page, price and stock included, so the conversation ends where a purchase can happen.' },
      { t: 167, label: 'Damaged item, escalation', talkTrack: 'Here is the handover. A damaged item is the case it correctly refuses to handle alone.' },
      { t: 199, label: 'The agent, with Copilot', talkTrack: 'Same conversation, agent side. Copilot is suggesting the reply and has already pulled the customer\'s ticket history.' },
      { t: 294, label: 'Task Assistant', talkTrack: 'Worth pointing out this panel. Task Assistant offers the next actions, booking an appointment or changing an address, so the agent is not navigating away to do them.' },
    ],
    keywords: ['retail', 'cognigy', 'copilot', 'handover', 'handoff', 'escalation', 'ai to human', 'agent assist', 'bot to agent', 'end to end chat', 'avatar', 'task assistant', 'product page', 'returns'],
  },
  'NiCE CXone - NiCE Retail Voice.mp4': {
    id: 'retail-voice',
    title: 'Retail: the voice AI agent',
    summary:
      'The voice counterpart to the retail chat clips, and the one that shows the Cognigy build alongside the call. A shopper phones NiCE Retail and speaks to a voice AI agent called Neil: opening hours, then the status of a specific order read back item by item with the total, then cancelling that order, then a question about tuxedos for a Christmas party. When the caller asks for a human, the agent hands over with a written Agentic Transfer Summary of the whole call, which is the part worth pausing on. The Cognigy flow and its live test panel are on screen throughout.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['voice self service', 'IVR replacement', 'order management', 'agentic handover', 'retail customer service'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect'],
    depth: 'functional',
    industries: ['retail'],
    references: [RETAIL_REFERENCE, COGNIGY_REFERENCE],
    chapters: [
      { t: 4, label: 'The call opens', talkTrack: 'A real phone call on the left, and the Cognigy flow that is driving it on the right. Useful for a technical audience, because you can see the tool calls fire as he speaks.' },
      { t: 50, label: 'Order status, read back in detail', talkTrack: 'Listen to the level of detail here: both line items, the order date and the total, read back accurately. That is a live system lookup, not a canned response.' },
      { t: 95, label: 'Cancelling the order', talkTrack: 'And now it acts on the account rather than describing how to. This is the difference between an IVR and an agent.' },
      { t: 140, label: 'A product question, answered from knowledge', talkTrack: 'Then a completely different intent, tuxedos for a Christmas party, answered from the product knowledge base in the same call.' },
      { t: 163, label: 'Handover with an Agentic Transfer Summary', talkTrack: 'This is the moment to stop on. The human agent does not arrive cold: they get a written summary of the whole call, the order number, and what the customer still needs.' },
    ],
    keywords: ['retail', 'voice', 'phone', 'call', 'ivr', 'voice bot', 'voice ai agent', 'speech', 'telephony', 'voice self service', 'order status', 'cancel order', 'transfer summary', 'agentic transfer', 'cognigy flow'],
  },
  'NiCE CXone Retail - NiCE Retail.mp4': {
    id: 'retail-end-to-end',
    // The two long cuts are titled by their practical difference, length and whether they are
    // narrated, which is what a visitor actually chooses between. Naming "supervisor" in the
    // title put this 24-minute overview above the dedicated Supervisor Workspace demo on "what
    // does the supervisor experience look like?", which is the wrong answer to give. What it
    // covers lives in the summary, the chapters and the keywords instead, all of which weigh
    // less than a title.
    title: 'Retail end to end: the 24-minute walkthrough',
    summary:
      'The longest cut in the retail set at 24 minutes. It opens on the same self-service and agent story as the other long cut, then turns towards the people-management half of the platform: evaluations, a coaching summary per agent, the supervisor view with handle time against target, Interactions Hub, the Cognigy prompt editor, Copilot knowledge settings, Topic AI and an analytics word cloud, quality management, and finally performance dashboards and a monthly coaching focus board. Effectively silent, so it needs someone to talk over it.',
    products: ['CXone Mpower', 'Cognigy AI Agents', 'CXone Supervisor Workspace', 'CXone Performance Management'],
    useCases: ['platform overview', 'end to end journey', 'supervisor experience', 'performance management', 'coaching'],
    personas: ['cx-leader', 'contact-center-ops', 'agent-supervisor', 'procurement'],
    depth: 'overview',
    industries: ['retail'],
    references: [RETAIL_REFERENCE, SUPERVISOR_COPILOT_REFERENCE],
    chapters: [
      { t: 29, label: 'Self-service on the retail site', talkTrack: 'It starts where the other long cut starts, with the shopper and the AI agent.' },
      { t: 173, label: 'The agent, with Copilot', talkTrack: 'Then the agent desktop and Copilot. The first six minutes of this cut and the narrated one are the same footage.' },
      { t: 461, label: 'Evaluations', talkTrack: 'From here the two long cuts part company. This one goes towards managing people rather than towards analytics.' },
      { t: 533, label: 'Coaching summary per agent', talkTrack: 'A coaching summary written per agent, drawn from their actual interactions rather than from a manager\'s memory.' },
      { t: 606, label: 'The supervisor view', talkTrack: 'The supervisor view, and note the agent detail panel: this month\'s handle time against target and against last month, which is the number a retail operation actually manages.' },
      { t: 750, label: 'Interactions Hub', talkTrack: 'A pass through Interactions Hub, the same screen covered properly in clip five.' },
      { t: 822, label: 'The Cognigy prompt editor', talkTrack: 'Worth flagging for a technical visitor: this is where the Copilot prompts themselves are authored.' },
      { t: 894, label: 'Copilot knowledge settings', talkTrack: 'And the knowledge settings behind Copilot, which is the answer to where its answers come from.' },
      { t: 966, label: 'Topic AI and the word cloud', talkTrack: 'Topic AI now. The word cloud is a good visual for a non-technical audience: payment issue, faulty, cancel. That is the demand, unprompted.' },
      { t: 1111, label: 'Quality management review', talkTrack: 'The quality review form and its question builder.' },
      { t: 1255, label: 'Performance dashboards', talkTrack: 'Then performance: scores by agent, top contributors, questioning skills.' },
      { t: 1327, label: 'The monthly coaching focus board', talkTrack: 'And it lands on a monthly focus board, prioritising who to coach on what. That is the closing argument of this cut: the loop ends in a management action.' },
    ],
    keywords: ['retail', 'end to end', 'full platform', 'whole journey', 'overview', 'complete', 'long version', 'everything', 'supervisor', 'performance management', 'coaching', 'evaluations', 'word cloud', 'topic ai', 'prompt editor'],
  },
  'NiCE Retail - NiCE CXone Full Platform - With voice over.mp4': {
    id: 'retail-full-platform-narrated',
    title: 'Retail end to end: the narrated 20-minute walkthrough',
    summary:
      'The narrated 20-minute cut, and the only asset in the retail set with a real voice over, which makes it the one to leave playing or to send to someone. It opens on the same self-service and agent footage as the other long cut, then takes the analytics path: Interactions Hub with call and screen playback, Copilot configuration, quality management with auto scoring and its prompt editor, Interaction Analytics dashboards, and it finishes on the Automation Opportunity view where an automation candidate becomes a Cognigy agent. Covers the numbered clips one through eight in one run.',
    products: ['CXone Mpower', 'Cognigy AI Agents', 'CXone Interaction Analytics', 'CXone Quality Management'],
    useCases: ['platform overview', 'end to end journey', 'self-guided viewing', 'analytics', 'automation opportunity sizing'],
    personas: ['cx-leader', 'contact-center-ops', 'procurement', 'it-architect'],
    depth: 'overview',
    industries: ['retail'],
    references: [RETAIL_REFERENCE, INTERACTIONS_HUB_REFERENCE],
    chapters: [
      { t: 24, label: 'Self-service on the retail site', talkTrack: 'Same opening as the other long cut, but this one is narrated, so you can let it run.' },
      { t: 208, label: 'The agent, with Copilot', talkTrack: 'The agent desktop and Copilot in App Space.' },
      { t: 392, label: 'Interactions Hub playback', talkTrack: 'Here the two long cuts diverge. This one turns towards the data: call and screen playback, with an evaluation attached.' },
      { t: 453, label: 'Copilot configuration', talkTrack: 'The configuration behind Copilot, including its persona. Useful if someone asks how much of this is tunable.' },
      { t: 699, label: 'Quality management and auto scoring', talkTrack: 'Quality management, with the interaction review scored automatically rather than by hand.' },
      { t: 821, label: 'The scoring prompt editor', talkTrack: 'And the prompt behind that scoring, which is the honest answer to how the AI decides.' },
      { t: 1067, label: 'Interaction Analytics dashboards', talkTrack: 'Analytics: the themes with the worst satisfaction, top keywords, call reasons and their metrics.' },
      { t: 1189, label: 'Automation Opportunity, and a Cognigy agent from it', talkTrack: 'It finishes on the strongest slide in the set. Automation opportunities ranked by volume, and a Cognigy agent created from the one you pick. That is the loop closing.' },
    ],
    keywords: ['retail', 'voice over', 'narrated', 'commentary', 'full platform', 'end to end', 'overview', 'leave behind', 'send me', 'analytics', 'automation opportunity', 'auto scoring', 'interactions hub', 'playback'],
  },

  'NiCE Homes (Real-estate and Rental and property management).mp4': {
    id: 'homes-property-management',
    title: 'NiCE Homes: a voice assistant for lettings and property management',
    summary:
      'A vertical nothing else in the room covers. NiCE Homes is a fictional lettings agency managing rental property across Greater Manchester, with a voice assistant for tenants. A tenant calls about heating that has stopped working; the assistant talks them through checking the consumer unit, confirms their safety, books a repair appointment, and then recommends available properties, ending on a full property listing with photos and an enquiry button. The right-hand half of the screen is the tenant CRM and repair calendar, updating live as the call proceeds, which is what makes this worth showing: the assistant is writing into a system of record, not just talking.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['voice self service', 'tenant and resident service', 'appointment scheduling', 'field service dispatch', 'maintenance triage'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect'],
    depth: 'functional',
    // No industries: real estate is deliberately absent from catalog/industries.json, which
    // returns null rather than forcing it into the nearest-looking vertical. So this asset is
    // reachable by keyword only, never by a vertical shortcut. See catalog/chapters-todo.md.
    references: [COGNIGY_REFERENCE],
    chapters: [
      { t: 6, label: 'A tenant calls about the heating', talkTrack: 'Left half is the tenant site and the voice assistant. Right half is the letting agent\'s CRM. Keep an eye on the right as the call goes on.' },
      { t: 60, label: 'Booking the repair appointment', talkTrack: 'It identifies the tenant and their address, then books the repair. The appointment appears in the calendar on the right while you watch, which is the point: it is writing into the system, not taking a message.' },
      { t: 176, label: 'Talking the tenant through the fuse box', talkTrack: 'This part is a genuine triage. It walks them to the consumer unit, gets the power back, and then tells them when to treat it as unsafe and call the emergency line. A lot of repair calls end here and never need a visit.' },
      { t: 254, label: 'Recommending available properties', talkTrack: 'Then it switches job entirely, from maintenance to lettings, and starts matching available properties to what they want.' },
      { t: 282, label: 'The property listing', talkTrack: 'And it ends on a full listing, photos and an enquiry button. Same assistant, two completely different business processes.' },
    ],
    keywords: ['real estate', 'realestate', 'property', 'property management', 'rental', 'renting', 'lettings', 'landlord', 'tenant', 'resident', 'housing', 'estate agent', 'realtor', 'lease', 'maintenance request', 'repair', 'heating', 'appointment booking', 'viewing', 'homes', 'voice assistant', 'crm update'],
  },

  // ========================================================================================
  // NiCE World London vertical assets, in Resources/NiCE World - Vertical Assets/<vertical>/.
  //
  // The best content in the room for a vertical conversation, and the worst for governance.
  //
  // WHAT THEY ARE. Eleven scenario demos, one fictional brand per industry: FinanceOne in
  // financial services, UK Work & Support Service in government, NiCE Energy & Utilities,
  // NiCE Healthcare, YourTelco. Each follows the same spine and that consistency is the
  // point, because you can show the same architecture in a prospect's own vertical:
  // self-service with a Cognigy AI agent, handover into CXone Agent Workspace with Copilot
  // in App Space, then a wrap-up with an auto-generated summary and a disposition. Several
  // put the Cognigy flow editor on screen beside the conversation, so they double as the
  // technical view. Two industries are covered twice on purpose, once on chat and once on
  // voice. The "Retail and Travel" folder is present but empty.
  //
  // GOVERNANCE. These are screen recordings of a working laptop and a phone, so the machine
  // is in shot as well as the demo: message history, mobile numbers, app notification
  // badges, Cognigy project and flow object ids in the address bar, the Windows taskbar and
  // clock, a browser profile photo.
  //
  // That was raised as a blocker and REVIEWED AND CLEARED by the content owner on 2026-09-08:
  // the personal information on screen is demo data, not a real person's. All eleven are
  // therefore approved:true with the reviewer and date recorded in the catalog, which is the
  // only content gate this system has. The review trail, and the frame timestamps it was
  // based on, are in catalog/chapters-todo.md. Specifics are deliberately not repeated here
  // because this repository is public.
  //
  // AUDIO, measured rather than assumed. Six of the eleven are effectively silent: an audio
  // stream is present but digitally empty, and NWL healthcare has no audio stream at all.
  // The voice demos do have sound, because you hear the call itself. None has a narrator.
  // Said in each summary, because it decides whether the room can leave one playing or has
  // to talk over it.
  // ========================================================================================

  'NiCE World - Vertical Assets/Energy and Utilities/NWL Chat end to end.mp4': {
    id: 'utilities-chat-end-to-end',
    // Titled on "move home", and deliberately WITHOUT the word "agent".
    //
    // This one is worth explaining because the margin was 0.05. On "show me a utilities
    // customer using agentic AI" the right answer is the Helen case study, a real customer
    // story. "customer" is a stopword and "ai" is too short to be a term, so the query is
    // effectively [utilities, agentic]. Helen has "agentic" exactly in its title, worth 3.
    // This asset has no "agentic" anywhere, but "agentic" stems to "agent", and a stem hit in
    // a TITLE scores 3 x 0.85 = 2.55. Add the flat +0.5 that any chaptered asset gets and a
    // fictional demo edged out the real customer story, because Helen is a document and a
    // document can never earn that bonus. Keeping "agent" out of the title drops this to an
    // identifying-field stem hit and the case study wins again. See catalog/chapters-todo.md
    // for the underlying scoring wrinkle, which is a decision for a person, not a title tweak.
    title: 'Energy: a move-home chat, self-service through to wrap-up',
    summary:
      'The cleanest end-to-end chat demo in the set, on a fictional energy retailer called NiCE Energy & Utilities. A customer moving home talks to a virtual assistant called Buzz about final meter readings and changing their address, then the conversation escalates to a human agent who has Copilot alongside them in App Space: a transfer summary so they arrive with context, live sentiment, suggested replies, and knowledge articles for exactly these tasks. It ends properly, with the wrap-up generating the interaction summary automatically and the agent rating Copilot. Silent, so it needs narrating.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['self service', 'escalation handling', 'agent assist', 'move home', 'meter readings', 'auto summary'],
    personas: ['cx-leader', 'contact-center-ops', 'agent-supervisor'],
    depth: 'functional',
    industries: ['utilities'],
    references: [COGNIGY_REFERENCE],
    chapters: [
      { t: 7, label: 'The energy site and Buzz', talkTrack: 'A fictional energy supplier, and the assistant has a name and a character. Small thing, but it is a decision a utility brand gets to make.' },
      { t: 45, label: 'Meter readings and moving home', talkTrack: 'Two of the highest-volume utility contacts, handled in self-service: a final meter reading and a change of address.' },
      { t: 138, label: 'Handover to a human agent', talkTrack: 'Now the agent side. Note they open with a transfer summary, so they are not asking the customer to start again.' },
      { t: 203, label: 'Copilot: sentiment, replies, knowledge', talkTrack: 'This right-hand panel is App Space. Sentiment on the conversation, a suggested reply, and the knowledge articles for a final meter reading and an address change.' },
      { t: 333, label: 'Wrap-up and the auto summary', talkTrack: 'The wrap-up is worth showing. The summary is generated when the interaction ends, so the agent is not typing notes.' },
      { t: 366, label: 'Rating Copilot', talkTrack: 'And it closes with the agent rating Copilot, which is how the feedback loop gets its data.' },
    ],
    keywords: ['energy', 'utilities', 'utility', 'gas', 'electricity', 'meter reading', 'moving home', 'change of address', 'chat', 'self service', 'handover', 'copilot', 'auto summary', 'wrap up', 'transfer summary', 'nice world'],
  },
  'NiCE World - Vertical Assets/FSI/Digital FSI].mp4': {
    id: 'fsi-digital-end-to-end',
    title: 'Financial services: the full digital journey, with the Cognigy build on screen',
    summary:
      'The fullest financial-services demo, ten minutes on a fictional wealth and lending brand called FinanceOne. A customer authenticates, views a portfolio, makes a secure card payment and asks about a pension transfer; the Cognigy flow editor sits beside the conversation for the first three minutes so you can watch the identity check, the knowledge lookup and the payment step actually fire. It then hands over to a human agent with a customer card showing recent interactions, Copilot suggesting replies, and a structured form to capture the transfer request. Silent, so it needs narrating. The shorter handover clip is a cut of this same demo.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['self service', 'authentication', 'secure payment', 'pension transfer', 'agent assist', 'escalation handling'],
    personas: ['cx-leader', 'it-architect', 'contact-center-ops', 'procurement'],
    depth: 'technical',
    industries: ['financial'],
    references: [INDUSTRY_REFERENCE.financial, COGNIGY_REFERENCE],
    chapters: [
      { t: 13, label: 'FinanceOne, and the chat opens', talkTrack: 'A fictional wealth and lending brand. Note the compliance furniture on the page: regulated, encrypted, PCI. That framing matters for this audience.' },
      { t: 55, label: 'The Cognigy flow, beside the conversation', talkTrack: 'This is the part a technical buyer wants. The flow on the right is the thing answering on the left, and you can watch the nodes execute.' },
      { t: 98, label: 'Identity verification and the portfolio', talkTrack: 'Authentication first, then it reads back the portfolio. Real numbers from a real lookup, including a loss, which is a braver demo choice than it looks.' },
      { t: 184, label: 'Knowledge lookup on the product question', talkTrack: 'The product question is answered from knowledge rather than generated, which in a regulated industry is the difference between usable and not.' },
      { t: 227, label: 'Handover, and the customer card', talkTrack: 'Into the agent workspace. The customer information card carries their last interactions, so the agent has the history without asking for it.' },
      { t: 313, label: 'Copilot on a pension transfer', talkTrack: 'Copilot suggesting replies on a genuinely complex topic, a pension transfer and the charge that applies to it.' },
      { t: 442, label: 'Capturing the request on a form', talkTrack: 'And the structured capture. A regulated process needs the data in fields, not in free text, and Copilot is filling it from the conversation.' },
      { t: 570, label: 'Wrap-up and disposition', talkTrack: 'Ends the same way the others do: generated summary, disposition, done.' },
    ],
    keywords: ['financial services', 'fsi', 'finance', 'bank', 'banking', 'wealth', 'pension', 'pension transfer', 'portfolio', 'investment', 'authentication', 'identity verification', 'secure payment', 'card payment', 'take a payment', 'payment in chat', 'pay by card', 'pci', 'fca', 'regulated', 'cognigy flow', 'copilot', 'nice world'],
  },
  'NiCE World - Vertical Assets/FSI/Cognigy to CXOne Handover Example.mp4': {
    id: 'fsi-cognigy-to-cxone-handover',
    title: 'Financial services: the Cognigy to CXone handover, short version',
    summary:
      'A four-and-a-half minute cut of the FinanceOne journey, focused on the handover itself. Reach for this rather than the ten-minute version when the question is specifically how a Cognigy AI agent passes a customer to a CXone agent without losing context. Shows the flow editor beside the conversation, a secure card capture step, then the human agent picking up with Copilot. Has real audio, unlike most of this set, because you hear the interaction.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['escalation handling', 'agentic handover', 'authentication', 'secure payment', 'agent assist'],
    personas: ['it-architect', 'cx-leader', 'contact-center-ops'],
    depth: 'technical',
    industries: ['financial'],
    references: [INDUSTRY_REFERENCE.financial, COGNIGY_REFERENCE],
    chapters: [
      { t: 6, label: 'FinanceOne, and the chat opens', talkTrack: 'Same fictional brand as the longer FSI demo, same journey, about a third of the length.' },
      { t: 30, label: 'The flow, and identity verification', talkTrack: 'Conversation on the left, Cognigy flow on the right, verifying who they are.' },
      { t: 54, label: 'Secure card capture', talkTrack: 'A card capture step inside the conversation. Worth showing to anyone who assumes a chatbot cannot be in a payment path.' },
      { t: 103, label: 'The handover', talkTrack: 'And here is the whole reason to play this clip: the point of transfer, and what the human agent receives along with the customer.' },
      { t: 224, label: 'Copilot and the capture form', talkTrack: 'Copilot suggesting the reply, and the structured form for the request.' },
      { t: 273, label: 'Wrap-up', talkTrack: 'Generated summary and disposition to close.' },
    ],
    keywords: ['financial services', 'fsi', 'finance', 'bank', 'banking', 'handover', 'handoff', 'escalation', 'bot to agent', 'ai to human', 'cognigy to cxone', 'transfer', 'context', 'secure payment', 'card payment', 'take a payment', 'payment in chat', 'pay by card', 'authentication', 'nice world'],
  },
  'NiCE World - Vertical Assets/FSI/Voice_FSI.mp4': {
    id: 'fsi-voice',
    title: 'Financial services: the voice AI agent, with the build on screen',
    summary:
      'The FinanceOne journey on voice. A phone call runs on the left while the Cognigy flow and its live test panel run on the right, so you can see the voice agent authenticate the caller and work through their request before handing to a human agent in CXone with Copilot. Eight minutes, with real call audio. The natural pairing for the FSI chat demos when someone asks whether the same thing works on the phone.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['voice self service', 'IVR replacement', 'authentication', 'agent assist', 'escalation handling'],
    personas: ['it-architect', 'cx-leader', 'contact-center-ops'],
    depth: 'technical',
    industries: ['financial'],
    references: [INDUSTRY_REFERENCE.financial, COGNIGY_REFERENCE],
    chapters: [
      { t: 10, label: 'The call, and the flow behind it', talkTrack: 'Phone call on the left, the flow driving it on the right. Same architecture as the chat demo, different channel.' },
      { t: 54, label: 'Authenticating the caller', talkTrack: 'Identity verification over voice, which is the step every bank asks about first.' },
      { t: 97, label: 'Working through the request', talkTrack: 'The agent handles the request itself here, with the knowledge lookups visible in the panel as it goes.' },
      { t: 185, label: 'Into the CXone agent workspace', talkTrack: 'Handover. Note the agent gets the call and the context together.' },
      { t: 316, label: 'Copilot on the call', talkTrack: 'Copilot working on a live voice interaction rather than on chat text, which is the harder of the two problems.' },
      { t: 452, label: 'Disposition and wrap-up', talkTrack: 'And the close, with the disposition captured.' },
    ],
    keywords: ['financial services', 'fsi', 'finance', 'bank', 'banking', 'voice', 'phone', 'call', 'ivr', 'voice bot', 'voice ai agent', 'telephony', 'authentication', 'cognigy flow', 'copilot', 'nice world'],
  },
  'NiCE World - Vertical Assets/Government/Government Cognigy Chat, Copilot for Agents.mp4': {
    id: 'government-chat-and-copilot',
    title: 'Government: a citizen benefits claim, self-service through to caseworker',
    summary:
      'The most complete public-sector demo, on a fictional department called the UK Work & Support Service. A citizen makes a benefits claim in chat and the demo works through the things that usually stop a public-service journey going digital: photographing an identity document with the phone camera, signing on screen by hand, verifying by one-time code, and answering an eligibility check before starting. It then hands over to a caseworker in CXone with Copilot and structured forms. Silent, so it needs narrating. The self-service half also exists as a shorter standalone clip.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['citizen self service', 'document capture', 'digital signature', 'identity verification', 'eligibility checking', 'agent assist'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect', 'procurement'],
    depth: 'functional',
    industries: ['government'],
    references: [INDUSTRY_REFERENCE.government, COGNIGY_REFERENCE],
    chapters: [
      { t: 9, label: 'A government service, and the assistant', talkTrack: 'A fictional department, styled the way a UK government service is styled. The assistant sits on the page rather than behind a phone number.' },
      { t: 42, label: 'Explaining the benefit', talkTrack: 'It explains the benefit and how the taper works, which is exactly the kind of question that generates avoidable call volume.' },
      { t: 106, label: 'Photographing an identity document', talkTrack: 'This is the first of the hard ones. The citizen photographs a document with their phone camera, in the conversation, with guidance on lighting and framing.' },
      { t: 170, label: 'Signing by hand, on screen', talkTrack: 'And a handwritten signature, captured in the chat. Between this and the document, most of the reason these journeys stayed on paper is gone.' },
      { t: 203, label: 'One-time code verification', talkTrack: 'Verification by one-time code before anything sensitive proceeds.' },
      { t: 267, label: 'The eligibility check', talkTrack: 'Four questions to establish eligibility before the citizen invests fifteen minutes in an application they cannot complete. Worth calling out as a deflection story, not just a service one.' },
      { t: 299, label: 'Handover to a caseworker', talkTrack: 'Then the caseworker side, with Copilot and the structured forms a statutory process needs.' },
      { t: 440, label: 'Disposition and close', talkTrack: 'Generated summary, disposition, and Copilot feedback saved.' },
    ],
    keywords: ['government', 'public sector', 'citizen', 'benefits', 'claim', 'universal credit', 'welfare', 'dwp', 'council', 'document capture', 'photo id', 'signature', 'digital signature', 'otp', 'one time code', 'eligibility', 'caseworker', 'copilot', 'nice world'],
  },
  'NiCE World - Vertical Assets/Government/Cognigy Chat.mp4': {
    id: 'government-chat-self-service',
    title: 'Government: the citizen self-service half, on its own',
    summary:
      'The self-service half of the government benefits journey without the caseworker section, in four and a half minutes. Same fictional UK Work & Support Service: explaining the benefit, capturing an identity document with the camera, a handwritten signature, continuing the conversation over SMS, a one-time code, and an eligibility check. Use it when the audience only cares about the citizen-facing side. Silent, so it needs narrating. Read the governance note first: this file carries the clearest personal-data exposure in the set.',
    products: ['Cognigy AI Agents'],
    useCases: ['citizen self service', 'document capture', 'digital signature', 'identity verification', 'eligibility checking', 'SMS channel'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect'],
    depth: 'functional',
    industries: ['government'],
    references: [INDUSTRY_REFERENCE.government, COGNIGY_REFERENCE],
    chapters: [
      { t: 5, label: 'The service, and the assistant', talkTrack: 'Straight in on the citizen side. This clip never leaves it.' },
      { t: 29, label: 'Explaining the benefit', talkTrack: 'The eligibility and taper explanation, in plain language.' },
      { t: 99, label: 'Camera capture of a document', talkTrack: 'Camera or gallery, captured in the conversation.' },
      { t: 145, label: 'Handwritten signature', talkTrack: 'And signed by hand on screen, with a clear and a submit.' },
      { t: 192, label: 'Continuing over SMS', talkTrack: 'The conversation moves to SMS here, which is the channel a lot of this cohort actually uses.' },
      { t: 239, label: 'The eligibility check', talkTrack: 'Four questions, and it tells them whether to bother. Better for both sides than an abandoned application.' },
    ],
    keywords: ['government', 'public sector', 'citizen', 'benefits', 'claim', 'universal credit', 'welfare', 'document capture', 'photo id', 'signature', 'digital signature', 'otp', 'sms', 'text message', 'eligibility', 'self service', 'deflection', 'nice world'],
  },
  'NiCE World - Vertical Assets/Government/Voice Cognigy.mp4': {
    id: 'government-voice-cognigy',
    title: 'Government: a voice AI agent, in English and Welsh',
    summary:
      'A citizen phones the fictional UK Work & Support Service about their State Pension and is handled by a voice AI agent, with the Cognigy flow visible beside the call. Two things make this the strongest public-sector clip in the set. The caller asks for the answer more slowly and in Welsh, and gets it, which in Wales is a statutory requirement rather than a nice-to-have. And it handles third-party authority, someone acting as a delegate on another person\'s claim. It closes by texting the citizen a link to continue online. Has real call audio.',
    products: ['Cognigy AI Agents', 'CXone Mpower'],
    useCases: ['voice self service', 'multilingual service', 'accessibility', 'third-party authority', 'SMS deflection', 'state pension'],
    personas: ['cx-leader', 'it-architect', 'contact-center-ops', 'procurement'],
    depth: 'technical',
    industries: ['government'],
    references: [INDUSTRY_REFERENCE.government, COGNIGY_REFERENCE],
    chapters: [
      { t: 6, label: 'The call, and the flow behind it', talkTrack: 'Voice call on the left, the flow on the right. The AI agent has a name and a role, which is how a public body would present it.' },
      { t: 34, label: 'Explaining the benefit over voice', talkTrack: 'The same eligibility explanation as the chat demos, but spoken, which is harder: it has to be short enough to listen to.' },
      { t: 89, label: 'Slower, and in Welsh', talkTrack: 'This is the moment to stop on. The caller asks for it more slowly and in Welsh, and gets it. For a UK public-sector audience that is a compliance answer, not a feature.' },
      { t: 171, label: 'A signature, captured mid-journey', talkTrack: 'A signature comes back into the flow, so the voice journey is not limited to what can be said out loud.' },
      { t: 199, label: 'Acting as a delegate', talkTrack: 'And third-party authority: someone helping their partner claim. Every public service has this case and most digital journeys ignore it.' },
      { t: 308, label: 'Texting a link to continue online', talkTrack: 'It ends by sending a link so they can finish online, and closes the case. Channel switch as a deliberate outcome rather than a failure.' },
    ],
    keywords: ['government', 'public sector', 'citizen', 'state pension', 'pension', 'benefits', 'voice', 'phone', 'call', 'ivr', 'voice bot', 'welsh', 'cymraeg', 'multilingual', 'language', 'accessibility', 'delegate', 'third party', 'power of attorney', 'sms', 'deflection', 'nice world'],
  },
  'NiCE World - Vertical Assets/Government/Voice Copilot.mp4': {
    id: 'government-voice-copilot',
    title: 'Government: Copilot detecting a vulnerable citizen on a call',
    summary:
      'Three and a half minutes on the agent side of a government voice call, and the only asset in the room that shows vulnerability handling properly. Copilot flags a personal vulnerability from what the citizen says on the call, and the caseworker completes a vulnerability capture form: the category, whether consent was given to refer or escalate, and the contact details needed to act on it. It ends on the CRM record the case is written into. The best clip in the room for a public-sector or regulated buyer who asks about duty of care. Has real call audio.',
    products: ['CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['agent assist', 'vulnerability detection', 'duty of care', 'safeguarding', 'CRM integration', 'compliance'],
    personas: ['cx-leader', 'contact-center-ops', 'agent-supervisor', 'procurement'],
    depth: 'functional',
    industries: ['government'],
    references: [INDUSTRY_REFERENCE.government],
    chapters: [
      { t: 4, label: 'The call arrives', talkTrack: 'The citizen is already speaking to the AI agent when this starts. This clip is the human half.' },
      { t: 49, label: 'Copilot flags a vulnerability', talkTrack: 'Here is the point of the clip. Copilot has picked a vulnerability signal out of what was said and raised it, rather than leaving the agent to notice.' },
      { t: 72, label: 'The vulnerability capture form', talkTrack: 'And then it is captured properly: the category, and crucially whether the citizen consented to a referral. That consent question is what makes this defensible rather than intrusive.' },
      { t: 130, label: 'Contact details and next steps', talkTrack: 'Details captured so somebody can actually follow up.' },
      { t: 207, label: 'The CRM record', talkTrack: 'It finishes on the record in the CRM. Worth showing to anyone who asks where this ends up, because a safeguarding flag that lives only in a transcript is no use.' },
    ],
    keywords: ['government', 'public sector', 'citizen', 'vulnerability', 'vulnerable customer', 'safeguarding', 'duty of care', 'consent', 'referral', 'escalation', 'copilot', 'voice', 'call', 'crm', 'compliance', 'fca', 'tcf', 'nice world'],
  },
  'NiCE World - Vertical Assets/Healthcare/NWL healthcare.mp4': {
    id: 'healthcare-patient-journey',
    title: 'Healthcare: a patient journey across SMS, chat and the agent desk',
    summary:
      'Nine minutes on a fictional digital health provider, NiCE Healthcare, and the only demo in the room that spends its first three minutes inside a phone. A patient is handled over SMS with a verification code and an interactive list to pick a consultation type, then on web chat for a repeat prescription with an identity check and a choice of pharmacy collection or delivery, then by a human agent who checks a referral, advises the patient and books an appointment. Note before showing it: this file has no audio track at all, so it plays completely silent.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Digital'],
    useCases: ['patient self service', 'SMS channel', 'repeat prescriptions', 'appointment scheduling', 'referral status', 'identity verification'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect'],
    depth: 'functional',
    industries: ['healthcare'],
    references: [INDUSTRY_REFERENCE.healthcare, COGNIGY_REFERENCE],
    chapters: [
      { t: 11, label: "On the patient's phone", talkTrack: 'It opens on a phone rather than a website, which is right for healthcare: this cohort is not sitting at a desk.' },
      { t: 88, label: 'Verification by code over SMS', talkTrack: 'A verification code over SMS. Note the demo even labels it as not a real message, which is the kind of care this content needs.' },
      { t: 127, label: 'Choosing a consultation type', talkTrack: 'An interactive list rather than free text: standard, long, or urgent same-day. Structured choices are safer than open questions in a clinical context.' },
      { t: 204, label: 'A repeat prescription in web chat', talkTrack: 'Now on web chat, for a repeat prescription. It verifies identity by date of birth before it will discuss medication.' },
      { t: 290, label: 'Pharmacy collection or delivery', talkTrack: 'And it completes the task, including where the prescription goes. That is a whole call avoided.' },
      { t: 359, label: 'The agent picks up', talkTrack: 'The human side, with the patient record and a summary of the last interaction already on screen.' },
      { t: 460, label: 'Referral status and booking', talkTrack: 'Checking a referral and booking the appointment. These are the two things patients chase most, so it is a well-chosen ending.' },
      { t: 552, label: 'Resolved', talkTrack: 'Dispositioned as resolved, with positive sentiment recorded.' },
    ],
    keywords: ['healthcare', 'health', 'patient', 'gp', 'clinician', 'nhs', 'prescription', 'repeat prescription', 'pharmacy', 'appointment', 'appointment booking', 'referral', 'sms', 'whatsapp', 'mobile', 'triage', 'consultation', 'identity verification', 'silent', 'nice world'],
  },
  'NiCE World - Vertical Assets/Telco & IT/Telco_chat.mp4': {
    id: 'telco-chat-vulnerable-customer',
    // "enquiry", not "conversation", for the same reason as the energy title above: the generic
    // word outranked CXone Agent Copilot on "how do you help agents during a conversation?".
    title: 'Telecom: a billing enquiry and a payment plan for a struggling customer',
    summary:
      'Four minutes on a fictional business telco, YourTelco, laid out as a split screen with the agent desktop on the left and the customer\'s own browser on the right, so you see both sides at once. The AI agent presents roaming plans as rich cards, then the conversation escalates: the customer is struggling to pay. Copilot raises a potential vulnerability and puts the required process on screen, and the agent sets up a payment plan on a structured form with a vulnerability flag. Ends with a disposition and an automatic summary. Has real audio.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['self service', 'plan comparison', 'billing', 'payment plans', 'vulnerability detection', 'collections', 'agent assist'],
    personas: ['cx-leader', 'contact-center-ops', 'agent-supervisor'],
    depth: 'functional',
    industries: ['telecom'],
    references: [INDUSTRY_REFERENCE.telecom, COGNIGY_REFERENCE],
    chapters: [
      { t: 5, label: 'Both sides at once', talkTrack: 'The layout is the useful thing here: agent desktop on the left, what the customer sees on the right. Good for explaining the handover without switching screens.' },
      { t: 69, label: 'Roaming plans as rich cards', talkTrack: 'Plans presented as cards with prices and inclusions, so the customer can compare rather than be read a list.' },
      { t: 90, label: 'Escalation to a human', talkTrack: 'The conversation turns to the bill, and it hands over.' },
      { t: 154, label: 'Copilot flags a potential vulnerability', talkTrack: 'Copilot raises a potential vulnerability and, importantly, puts the process the agent has to follow on the screen. For a regulated collections conversation that is the whole point.' },
      { t: 175, label: 'Setting up the payment plan', talkTrack: 'A structured payment plan: the reason for the difficulty, the vulnerability flag, and the duration. Captured as data, so it is auditable.' },
      { t: 218, label: 'Disposition and auto summary', talkTrack: 'Dispositioned, with the summary generated after the interaction ends.' },
    ],
    keywords: ['telecom', 'telco', 'telecommunications', 'mobile', 'broadband', 'roaming', 'plan', 'tariff', 'billing', 'bill', 'payment plan', 'arrears', 'collections', 'financial difficulty', 'vulnerability', 'vulnerable customer', 'tcf', 'fca', 'copilot', 'nice world'],
  },
  'NiCE World - Vertical Assets/Telco & IT/Telco_voice.mp4': {
    id: 'telco-voice-channel-switch',
    title: 'Telecom: a voice call that moves the customer to their phone screen',
    summary:
      'The YourTelco scenario on voice, and the clearest demonstration in the room of switching channel mid-conversation on purpose. During the call the AI agent sends a link, the customer opens the roaming plans on their phone, chooses one and gets a confirmation, all without leaving the call. It then moves to the agent desk, where Copilot provides a transfer summary and raises the same potential-vulnerability process, and the agent completes a payment-difficulty form. Six and a half minutes, ending on a NiCE end card. Has real call audio.',
    products: ['Cognigy AI Agents', 'CXone Agent Copilot', 'CXone Agent Workspace'],
    useCases: ['voice self service', 'channel switching', 'plan comparison', 'payment plans', 'vulnerability detection', 'agent assist'],
    personas: ['cx-leader', 'contact-center-ops', 'it-architect'],
    depth: 'functional',
    industries: ['telecom'],
    references: [INDUSTRY_REFERENCE.telecom, COGNIGY_REFERENCE],
    chapters: [
      { t: 8, label: 'The call starts', talkTrack: 'A voice call on the telco site, with the spoken exchange captioned as it goes.' },
      { t: 75, label: 'A link arrives on the phone', talkTrack: 'And here is the interesting move. Rather than reading tariffs down the phone, it sends a link.' },
      { t: 142, label: 'Choosing a plan on the phone', talkTrack: 'The customer is now comparing plans on their own screen while still on the call. Voice for the conversation, screen for the comparison, which is what each is actually good at.' },
      { t: 209, label: 'Confirmed', talkTrack: 'Confirmed on the phone. The call carried on throughout.' },
      { t: 243, label: 'The agent, with a transfer summary', talkTrack: 'Then the agent desk, and Copilot has written the transfer summary so they arrive with the story.' },
      { t: 320, label: 'The vulnerability process again', talkTrack: 'Same potential-vulnerability flag and required process as the chat version, on a voice interaction this time.' },
      { t: 344, label: 'The payment difficulty form', talkTrack: 'And the payment plan captured on a form, with the reason recorded.' },
    ],
    keywords: ['telecom', 'telco', 'telecommunications', 'mobile', 'broadband', 'roaming', 'plan', 'tariff', 'voice', 'phone', 'call', 'voice bot', 'channel switch', 'multimodal', 'sms link', 'billing', 'payment plan', 'vulnerability', 'transfer summary', 'nice world'],
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

/**
 * Industry tags, normalised to the twelve in catalog/industries.json.
 *
 * The catalog previously carried two incompatible schemes: hand-curated videos used lowercase
 * free text ("insurance", "financial services", "banking") while the nice.com documents carried
 * NiCE's taxonomy ("Financial", "Government"). So Financial, financial services and banking
 * were three labels for one vertical, and a visitor matched to Financial would have seen a
 * third of what the room actually holds.
 *
 * Unmapped tags are DROPPED and reported rather than passed through. Keeping them would rebuild
 * the fragmentation this exists to remove, and silently dropping them would hide real content
 * from a vertical nobody notices is missing.
 */
function loadIndustryRules() {
  const p = path.join(repoRoot, 'catalog', 'industries.json')
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
  const junk = new Set(raw.junk.values)
  const overrides = raw.exactOverrides
  const clean = (v) =>
    String(v)
      .replace(/[​-‍﻿­]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

  return function normalise(value) {
    const key = clean(value)
    if (!key || junk.has(key)) return null
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const slug = overrides[key]
      const hit = raw.industries.find((i) => i.slug === slug)
      return hit ? hit.label : null
    }
    for (const rule of raw.industries) {
      if (rule.aliases.some((a) => key.includes(a))) return rule.label
    }
    return null
  }
}
const normaliseIndustry = loadIndustryRules()
const droppedIndustries = new Map()

function canonicalIndustries(values, assetId) {
  const out = []
  for (const value of values ?? []) {
    const label = normaliseIndustry(value)
    if (!label) {
      const seen = droppedIndustries.get(value) ?? []
      seen.push(assetId)
      droppedIndustries.set(value, seen)
      continue
    }
    if (!out.includes(label)) out.push(label)
  }
  return out
}

/** Spreadable, so an asset with no mappable tag simply has no industries key. */
function industriesField(values, assetId) {
  const tags = canonicalIndustries(values, assetId)
  return tags.length > 0 ? { industries: tags } : {}
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

/**
 * Which videos a remote host actually serves, keyed by asset id, from
 * catalog/remote-media.json. Written by tools/probe-remote-media.mjs.
 *
 * This build stays deterministic and offline: it reads a committed manifest rather than
 * probing the network, so the same source always produces the same catalog and a build outside
 * the lab network does not silently drop every remote URL. Re-run the probe after uploading
 * videos, then re-run this.
 *
 * Absent manifest is normal, not an error: it just means no asset gets a remoteUrl, which is
 * the behaviour this script had before remote hosting existed.
 */
function readRemoteMedia() {
  const p = path.join(repoRoot, 'catalog', 'remote-media.json')
  try {
    const manifest = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (!manifest.base || typeof manifest.available !== 'object') return { base: null, available: {} }
    return { base: manifest.base, available: manifest.available }
  } catch {
    return { base: null, available: {} }
  }
}
const REMOTE_MEDIA = readRemoteMedia()

if (!fs.existsSync(MEDIA_DIR)) {
  console.error(`Media directory not found: ${MEDIA_DIR}`)
  console.error('Pass --media <path> or set the videos where the script expects them.')
  process.exit(1)
}

/**
 * Every video under the media root, as a path relative to it with forward slashes.
 *
 * Recursive because the NiCE World vertical assets are filed one folder per industry. A flat
 * readdir found none of them and, worse, said nothing: they were simply absent from the
 * catalog with no warning, which is the failure mode missingMeta below exists to prevent.
 */
function walkMedia(dir, rel = '') {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walkMedia(path.join(dir, entry.name), relPath))
    else if (MIME_EXT.has(path.extname(entry.name).toLowerCase())) out.push(relPath)
  }
  return out
}

const files = walkMedia(MEDIA_DIR).sort((a, b) => a.localeCompare(b))

/** `/media/a b/c.mp4` -> `/media/a%20b/c.mp4`. Each segment is encoded, the slashes are not. */
function mediaUrl(relPath) {
  return `/media/${relPath.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * The absolute URL for an asset the remote host confirmed it serves, or null.
 *
 * The path comes from the manifest rather than being derived from relPath, because the host
 * holds these files FLAT by basename even where they are filed into per-industry folders
 * locally. The probe records which form actually answered, so this does not have to guess.
 */
function remoteUrlFor(id) {
  const entry = REMOTE_MEDIA.available[id]
  if (!entry?.path || !REMOTE_MEDIA.base) return null
  return `${REMOTE_MEDIA.base}${entry.path.split('/').map(encodeURIComponent).join('/')}`
}

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
    ...industriesField(meta.industries ?? prior.industries, meta.id),
    // Prior wins: a hand-corrected duration should survive regeneration.
    durationSeconds: prior.durationSeconds ?? DURATIONS[name] ?? null,
    source: {
      provider: 'local',
      url: mediaUrl(name),
      // Only present for the videos the remote host confirmed it serves, so a static build has
      // a real source for those and keeps degrading honestly for the rest. Never derived: see
      // remoteUrlFor(). app/src/catalog.ts prefers the local path when the files are on disk
      // and falls back to this, so local development stays offline and fast.
      ...(remoteUrlFor(meta.id) ? { remoteUrl: remoteUrlFor(meta.id) } : {}),
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
    // Same precedence as chapters above: a hand-edited catalog wins, then META, then the
    // product-derived default. META needs a say here because referencesFor() can only map a
    // product name to a product page, and the retail set's best further reading is NiCE's
    // retail datasheet, which is a property of the scenario rather than of any one product.
    references: prior.references?.length
      ? prior.references
      : meta.references?.length
        ? meta.references.slice(0, 3)
        : referencesFor(meta.products),
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
      ...industriesField(meta.industries, meta.id),
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

// Document assets, promoted from the nice.com resource library.
//
// The Digital Room is not only a video player: a visitor asking for proof, pricing rationale or
// a compliance answer usually wants something to read and forward, not a demo to watch. These
// give the stage something to propose in those cases.
//
// The split of responsibility is deliberate. Title, summary, content type and industries come
// from catalog/nice-resources-enriched.json, so they stay NiCE's own words and update when the
// site does. catalog/document-curation.json carries only what cannot be derived: which
// resources are worth showing, and the products, personas, depth and keywords that make them
// findable. Nothing here is invented about the resource itself.
function readJson(...parts) {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, ...parts), 'utf8'))
  } catch {
    return null
  }
}

const curation = readJson('catalog', 'document-curation.json')
const enriched = readJson('catalog', 'nice-resources-enriched.json')
const thumbnails = readJson('catalog', 'document-thumbnails.json')?.thumbnails ?? {}
const docSkipped = []

if (curation?.documents?.length) {
  if (!enriched?.items?.length) {
    // Deriving titles from slugs here would produce plausible-looking wrong titles under a
    // "reference" the visitor may bookmark, so refuse instead.
    console.error(
      'Refusing to build documents: catalog/nice-resources-enriched.json is missing or empty.\n' +
        'Run tools/fetch-nice-resources.ps1 then tools/enrich-nice-resources.ps1 first.',
    )
    process.exit(1)
  }

  const bySlug = new Map(enriched.items.map((item) => [item.slug, item]))

  for (const doc of curation.documents) {
    const resource = bySlug.get(doc.slug)
    if (!resource) {
      docSkipped.push(`${doc.slug} -> not in nice-resources-enriched.json`)
      continue
    }
    // An inferred type is a keyword guess. Showing it as a badge would present a guess as a
    // fact, so those are excluded rather than displayed with a caveat nobody reads.
    if (resource.typeSource !== 'site') {
      docSkipped.push(`${doc.slug} -> typeSource is "${resource.typeSource}", not "site"`)
      continue
    }

    const prior = byId.get(doc.slug) ?? {}
    const thumbnailUrl = thumbnails[doc.slug]
    if (!thumbnailUrl) {
      warnings.push(`No thumbnail for "${doc.slug}". Run tools/fetch-document-thumbnails.ps1.`)
    }

    assets.push({
      id: doc.slug,
      title: resource.title,
      summary: resource.description,
      type: 'document',
      // NiCE's own content type from the listing taxonomy, never an inferred one: the check
      // above guarantees typeSource is "site". Shown to the visitor as a badge.
      documentType: resource.type,
      // Published on nice.com, so the act of publishing is itself the external-use clearance,
      // exactly as for the YouTube embeds. Attributed to the site rather than to a person.
      approved: true,
      products: doc.products,
      useCases: doc.useCases,
      personas: doc.personas,
      depth: doc.depth,
      // Already NiCE's taxonomy, but run through the same gate so there is one path in and
      // one vocabulary out, whichever source an asset came from.
      ...industriesField(resource.industries, doc.slug),
      source: {
        provider: 'nice-web',
        url: resource.url,
        // Same value as url for a document: there is one public address and it is the page
        // itself. Kept because the renderer and the citation layer both read watchUrl to mean
        // "the canonical public link", so setting it makes documents citable with no special case.
        watchUrl: resource.url,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        requiresSignedUrl: false,
      },
      ...(prior.followUps?.length ? { followUps: prior.followUps } : {}),
      ...(prior.talkingPoints?.length ? { talkingPoints: prior.talkingPoints } : {}),
      // The site's own content type and industries are strong retrieval signal, so they join
      // the curated keywords rather than living only in the badge.
      keywords: [
        ...new Set([
          ...(doc.keywords ?? []),
          resource.type.toLowerCase(),
          ...(resource.industries ?? []).map((i) => i.toLowerCase()),
        ]),
      ],
      references: prior.references?.length ? prior.references : referencesFor(doc.products),
      reviewedOn: enriched.fetched ?? '2026-09-03',
      reviewedBy: 'Published publicly by NiCE on nice.com/resources',
    })
  }
}

// Refuse to write a catalog that is missing curated documents, for the same reason as
// missingMeta below: a partial write is worse than no write.
//
// This was originally a warning, which is a trap. tools/enrich-nice-resources.ps1 rewrites
// nice-resources-enriched.json in place and flushes every 25 records, so a build that runs
// while an enrichment is in flight sees a file holding 25 resources, drops all 27 documents,
// prints warnings nobody reads in a 60-line log, and writes a catalog with no documents in it
// at all. The app would then quietly have nothing to show.
if (docSkipped.length) {
  console.error('Refusing to write the catalog: curated documents could not be built.\n')
  for (const name of docSkipped) console.error(`  - ${name}`)
  console.error(
    '\nIf a slug is simply absent, check catalog/document-curation.json against\n' +
      'catalog/nice-resources-enriched.json. If many are absent at once, an enrichment run is\n' +
      'probably still in progress: wait for it to finish and re-run.',
  )
  process.exit(1)
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
    'GENERATED by tools/build-catalog.mjs. Do not hand-edit source.url, source.remoteUrl or ids; edit META, YOUTUBE_META or catalog/document-curation.json and regenerate, and re-run tools/probe-remote-media.mjs to change which videos carry a remoteUrl. Chapters, talkingPoints and review fields ARE hand-authored and are carried over on regeneration. Three kinds of asset with three different clearance stories: local videos are NiCE World 2026 conference masters, summarised from the title card and filename rather than from watching the session, and are approved:false until a named human clears them; YouTube embeds and nice.com documents are approved:true because NiCE published them publicly, which is itself the clearance, and reviewedBy records that rather than naming a person. source.remoteUrl means the remote media host answered 200 for that file when the probe last ran; it does NOT mean every visitor can play it, because that host presents a certificate from NiCE\'s internal PKI and so fails on any device without the NiCE corporate root. The player treats a media error as a fall back to simulated playback, which is what makes that survivable.',
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
console.log(`\nDocuments: ${assets.filter((a) => a.type === 'document').length} of ${curation?.documents?.length ?? 0} curated`)

const tagged = assets.filter((a) => a.industries?.length).length
console.log(`Industry tags: ${tagged} assets carry one of the twelve canonical verticals`)
if (droppedIndustries.size > 0) {
  // Reported, never silent. Each of these is real content that no vertical shortcut will now
  // reach, so it is a decision for a person: add the vertical to catalog/industries.json, or
  // retag the asset.
  console.log('\nIndustry tags dropped, no canonical vertical:')
  for (const [value, ids] of [...droppedIndustries].sort()) {
    console.log(`  - "${value}"  on ${ids.length} asset(s): ${[...new Set(ids)].slice(0, 3).join(', ')}`)
  }
}
if (warnings.length) {
  console.log('\nWarnings:')
  for (const w of warnings) console.log(`  ! ${w}`)
}
