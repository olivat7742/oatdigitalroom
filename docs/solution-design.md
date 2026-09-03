# Digital Room, Solution Design

> An agentic, self-service interactive showcase for NiCE CXone and Cognigy.
> The visitor asks questions. The AI guide answers, then *shows* the answer.
> Owner: Olivier Attia, Solutions Engineer, NiCE.
> Status: design agreed, build not started. See `build-plan.md`.

---

## 1. What this is

A conversational guide that turns a passive demo library into a dynamic, personalised
guided tour. The visitor drives with questions. The agent answers in a grounded way and
pushes matching visual content onto a stage: video with chapters, clickable walkthroughs,
architecture diagrams, comparison tables.

Positioning: an early sales-stage, self-service tool that reduces the number of live
"intro demo" calls a Solution Engineer has to run, while producing intent signal on what
each visitor actually cared about.

**Design principle that governs everything: show, do not tell.**
Any answer the agent can illustrate, it should illustrate. Text is the fallback, not the
default.

**Secondary principle: the tool is itself a demo.**
It runs on Cognigy. Its human escalation path runs on CXone Digital. A visitor asking
"how good is your AI agent, really?" gets the answer by using it.

---

## 2. Audience and content policy

**One content universe. Everything the solution shows is public and approved for external
use, for every audience, always.** Decided 2026-08-28.

Consequences, and they are large:

- No content tiering. No entitlement enforcement. No authentication required for access.
- No cross-audience leakage risk, because there is nothing non-public loaded to leak.
- Audience becomes a **personalisation** signal only. It changes tone, depth and framing. It never changes what content exists.
- Audience may be self-declared or inferred from conversation. This is safe *precisely because* misdeclaring gains nothing.

| Audience | What changes for them |
|---|---|
| Prospect | Business outcome framing, start at overview depth, discovery-oriented |
| Existing customer | Assumes platform familiarity, moves to adjacent and expansion capability |
| NiCE sales rep | Skips discovery, direct answers, wants the right asset fast |
| NiCE partner | As per rep, plus how to position it and where NiCE support begins |

### The gate that replaces tiering

`approved: true` on every catalog asset and every knowledge source. Nothing enters the
runtime content universe without external-use clearance, carrying a named reviewer and a
date.

This is now the *single* content control in the system. With tiering gone there is no
second line of defence, so approval has to be a real process rather than a default value.

### What the risk profile becomes

| Risk | Status | Control |
|---|---|---|
| Cross-tier content leakage | **Eliminated** | Nothing non-public is loaded |
| Tier escalation via prompt injection | **Eliminated** | No tiers exist to escalate to |
| Unapproved or invented capability claims | **Now the primary risk** | Grounding discipline, approved `talkingPoints`, honest `coverage: none` reporting |
| Damaging quotable output: pricing, roadmap, competitor claims | **Elevated** | Hard rails in the agent instructions. An unattended public tool is screenshottable, and a screenshot is a commitment. |
| Abuse and LLM cost on an anonymous public endpoint | Unchanged | Rate limiting, per-session token ceiling, tool-loop cap |
| Private *hosting* of public-cleared assets | Remains | See below |

That last row is the one that catches people. **Content cleared for public use is not the
same as content publicly hosted.** A demo video approved for external sharing but sitting
on SharePoint still needs a signed short-lived URL or a move to a public CDN. Public
content policy does not solve the hosting problem.

The threat model has shifted rather than shrunk. The attacker's goal is no longer to
extract internal content; it is to make the agent say something damaging and screenshot it.
The behavioural rails in `../cognigy/agent-instructions.md` therefore matter more now, not
less.

### Grounding sources under the public-only rule

**Runtime retrieval, queried live:**
- Curated Knowledge AI store, ingested from public NiCE content
- CXone Expert public documentation

**Build-time authoring inputs, never queried at runtime:**
- Sales enablement platform content
- RFP answer library

You selected all four sources originally. This preserves the value of the internal two
without creating a runtime path to them. They contain the best-written answers in the
company, so they are excellent *source material* when authoring the curated public store
and the per-asset `talkingPoints`. The distinction that matters: a person clears the
wording before it enters the runtime universe.

## 2b. Visitor identification

Decided 2026-08-31, and it revises the original "email only at handoff" position.

The conversation opens by identifying the visitor: **five questions covering seven fields**,
asked conversationally by the agent, one per turn.

| Question | Fields |
|---|---|
| Their name | firstName, lastName |
| Where they work and their role | company, jobTitle |
| Business email | email |
| Which department the project is for | department |
| What kind of solution they are looking at | interest |

**It is not a gate.** There is no form in front of the chat and nothing blocks an
unidentified visitor. The agent leads with the introduction, but if the visitor asks a real
question first it answers properly and then resumes. Three reasons that is the right shape
here:

- A client-side gate would be security theatre. The Cognigy endpoint is reachable directly and the catalog is in a public repo, so a form stops only non-technical visitors.
- All runtime content is public and approved, so there is nothing to protect.
- Gating before giving value is the classic way a self-service sales tool loses the visitors it wanted.

**It does trade against a principle in the agent's own instructions.** The agent is told not
to interrogate before giving value. Five opening questions is deliberately the opposite bet:
fewer visitors, better qualified. Worth revisiting if drop-off at the introduction turns out
to be high, which the Phase 4 telemetry will show.

### Identifying the company, and its logo

Once identified, the visitor's company logo appears in the middle of the header, with the NiCE
wordmark staying top left.

**The company name is never used to find the logo.** Names are ambiguous internationally:
"Orange", "Apex Logistics" and "Banque Lyonnaise" could be any of several organisations, and a
wrong guess would put a stranger's logo in a NiCE sales tool. The **email domain** is
authoritative, and it is already collected, so no extra question is needed in the normal case.

The exception is a personal email provider. `tom.baker@gmail.com` identifies no employer, and
without a blocklist the visitor would be shown Gmail's logo as their own. When the tool detects
one of about forty personal providers it adds a sixth question asking for the company website,
which then takes precedence. That is the only case where the introduction exceeds five
questions.

Logos come from DuckDuckGo's icon service, with Google's favicon service as a fallback. Both
were checked to return a genuine 404 for an unknown domain, so the `onError` fallback chain is
reliable rather than a guess; a service that answered 200 with a generic globe would put a
placeholder in the header looking like a real logo. If neither has the domain, the company name
is shown as text. Clearbit's logo API is deliberately not used: it is dead since the HubSpot
acquisition.

Worth knowing: whichever icon service is used learns which company domain was looked up.

### Where the identity goes

`OAT_DIGITAL_ROOM_save_visitor_profile` writes to the **Cognigy contact profile**, with
session context as a mirror and fallback. Two things were discovered by enumerating the
tenant's API rather than assumed, and both had already caused a silent fallback to context:

- The action is `actions.updateProfile`, not `actions.addToContactProfile`.
- The default profile schema has `firstname`, `lastname` and `email` but **no** company, jobTitle or department. Those go to `actions.addContactMemory`.

Salesforce logging is explicitly out of scope for now.

### Privacy

Collecting a name, employer, role and email is personal data processing, from an EU-facing
page, before any value is given. What is in place:

- The agent states the purpose in its opening turn.
- The privacy policy is rendered as a link under every reply that has no asset to cite, which includes the opening turn. Reachable at the point of collection, not buried in a footer.
- The agent never implies the visitor must answer, and accepts a refusal without repeating the request.

What is **not** in place, and needs a decision before this faces real prospects:

- **No consent record.** The profile schema carries `accepted_gdpr`, `privacy_policy` and `prevent_data_collection`, and none are set. Setting `accepted_gdpr` without asking would be a false record, so it is deliberately left alone. If you want a consent flag, the agent has to ask for consent explicitly.
- **No retention policy or erasure path** for the contact profile.
- Identification for access is legally distinct from permission to market. Do not treat having their email as permission to contact them.

### Lead capture, unchanged

`request_handoff` still enforces explicit consent before storing contact details, separately
from the introduction. Having someone's email because they typed it into a demo is not the
same as their agreement to be contacted about it.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Digital Room frontend  (React + TS + Vite, Zustand, MUI)    │
│                                                              │
│   ┌───────────────┐   ┌──────────────────────────────────┐   │
│   │  Chat rail    │   │  Stage                           │   │
│   │               │   │  video / walkthrough / diagram   │   │
│   │  the guide    │   │  / comparison                    │   │
│   └───────────────┘   └──────────────────────────────────┘   │
│         ▲  │                        ▲                        │
│         │  ▼ @cognigy/socket-client │ stage directives       │
└─────────┼──────────────────────────┼─────────────────────────┘
          │                          │
┌─────────┴──────────────────────────┴─────────────────────────┐
│  Cognigy AI Agent  "the guide"                               │
│  agentic tool selection, grounded, discovery-oriented        │
└──────────────────────────┬───────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Retrieval     │  │ Demo catalog  │  │ Session &     │
│ (public       │  │ + tour graph  │  │ handoff       │
│  sources)     │  │               │  │               │
└───────┬───────┘  └───────────────┘  └───────┬───────┘
        │                                     │
  Knowledge AI                          CXone Digital
  CXone Expert                          (live SE escalation)
                                        CRM lead capture
```

### 3.1 Frontend, the Showroom

Split screen. Chat rail plus stage. Connected to Cognigy over `@cognigy/socket-client`.

The frontend is a **thin renderer**. It holds no product logic and makes no decisions
about what to show. It receives typed stage directives and renders them. All intelligence
lives in the agent and its tools.

Keeping the directive contract narrow is the single most important maintainability
decision in this project. Every new directive action is a permanent frontend obligation.

### 3.2 Cognigy AI Agent, the guide

Agentic tool selection rather than a rigid flow tree. The visitor's path is not
predictable, so a decision tree would be either enormous or restrictive.

Persona and rails: `../cognigy/agent-instructions.md`.

One agent for all four audiences. With entitlement gone, the only difference between
audiences is framing, which a single instruction block handles.

### 3.3 Retrieval layer

A single `search_knowledge` tool queries the curated Knowledge AI store and CXone Expert
public docs, merges, reranks, and returns passages with citations. The agent sees one
interface.

Why both rather than one ingested store: CXone Expert docs go stale if copied, and they
carry the technical depth. The curated Knowledge AI store handles the narrative layer
where tone control matters most.

### 3.4 Demo catalog and tour graph

The catalog is the real asset of this project. The LLM is the commodity part.

Two fields turn a video library into a *guided* experience:

- `chapters[].talkTrack` — what the agent says while that chapter plays. This is the difference between playing a video at someone and guiding them through it.
- `followUps` / `prerequisites` — a journey graph, so "what should I see next" has a curated answer rather than a semantic guess.

Schema: `../contracts/demo-catalog.schema.json`. Seed examples: `../catalog/`.

### 3.5 Handoff

Three escalation shapes, in increasing value:

1. Capture interest and email, send a follow-up pack.
2. Book a meeting with a Solution Engineer.
3. **Live escalation into CXone Digital**, so a real SE picks up with full context of what the visitor asked and saw.

Option 3 is the one worth engineering. It converts at the moment of peak interest, and it
demonstrates CXone AI-to-human escalation instead of describing it.

---

## 4. Telemetry

Every session records: questions asked, assets shown, chapters actually watched, drop-off
point, profile captured, handoff outcome.

This is a deliverable in its own right. Aggregated, it tells product marketing which
messages land, and it gives sales a ranked list of what a given account cared about.

---

## 5. Explicit non-goals

- Not a replacement for a live tailored demo. It is a qualifier and an educator that makes the live demo shorter and sharper.
- **No live CXone tenant embedding in v1.** Content is pre-recorded video plus clickable simulations. This removes demo-tenant fragility and data hygiene from the critical path.
- **No non-public content, for any audience.** Internal enablement and RFP material is build-time source material only.
- No pricing answers, no roadmap commitments, no competitor disparagement. Hard rails in the agent instructions.

---

## 6. Open items

| Item | Needed for | Owner |
|---|---|---|
| Cognigy MCP API key currently returns `401` | Any build in the tenant | Olivier |
| Where the demo videos live, and whether their URLs are publicly reachable or need signing | Catalog population | Olivier |
| External-use approval process and named reviewer for the `approved` flag | Go-live | Marketing / Legal |
| Access to enablement and RFP content for build-time authoring | Knowledge store quality | Olivier |
| Hosting for the frontend and the retrieval backend | Deployment | Olivier |
| CORS allow-list for any DFO host used by live handoff | Handoff option 3 | NiCE |
