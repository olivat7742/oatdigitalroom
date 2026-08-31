# Digital Room, tool specifications

> Seven tools. Each is specified as the agent sees it (description and input schema) plus
> what the backend must do. These are ready to create via `create_tool` once the Cognigy
> MCP API key is working.

**Design rule:** the agent decides *what* to do, the backend decides *what is allowed*.
Approval status, URL signing, and consent are backend concerns. Never delegate them to the
prompt.

**Content policy:** all content is public and identical for every audience. There is no
tiering and no entitlement check. The one content gate is `approved: true`, enforced in the
backend.

---

## 1. `search_knowledge`

Grounded answers. Queries the two public runtime sources, merges, reranks.

**Agent-facing description**
> Search NiCE product knowledge to answer a question about what CXone or Cognigy can do, how to configure something, or how something works technically. Use this before making any factual claim about product capability. If results are empty or weak, say so rather than answering from your own knowledge.

**Input**
```json
{
  "query":   { "type": "string", "description": "The visitor's question, rewritten as a standalone search query with pronouns resolved." },
  "depth":   { "type": "string", "enum": ["overview", "functional", "technical"], "description": "Match to the visitor's role. Optional." },
  "maxResults": { "type": "number", "default": 5 }
}
```

**Output**
```json
{
  "passages": [ { "text": "...", "sourceTitle": "...", "sourceUrl": "...", "confidence": 0.0 } ],
  "coverage": "good | partial | none"
}
```

**Backend responsibilities**
- Query only the two runtime sources, identically for every audience:
  - Curated Knowledge AI store, ingested from public NiCE content
  - CXone Expert public documentation
- The sales enablement platform and the RFP answer library are **build-time authoring inputs only** and must not be reachable from this tool. Do not wire those connectors into the runtime backend at all.
- Rerank across sources, deduplicate near-identical passages.
- Return `coverage: "none"` explicitly rather than low-confidence filler. The agent's honesty rail depends on being told the truth about retrieval quality, and with tiering gone that rail is the primary control against bad claims.
- Every returned `sourceUrl` must be publicly reachable, since the visitor may click it.

---

## 2. `find_demo`

Search the demo catalog.

**Agent-facing description**
> Find showable content (video, clickable walkthrough, diagram, comparison) matching a topic or question. Call this whenever a visitor asks about something you could illustrate, which is most of the time. Returns candidates with ids; use show_on_stage to display one.

**Input**
```json
{
  "intent":   { "type": "string", "description": "What the visitor wants to understand, in their words." },
  "products": { "type": "array", "items": { "type": "string" } },
  "personas": { "type": "array", "items": { "type": "string" } },
  "depth":    { "type": "string", "enum": ["overview", "functional", "technical"] },
  "maxResults": { "type": "number", "default": 3 }
}
```

**Output**
```json
{
  "matches": [
    { "id": "...", "title": "...", "summary": "...", "type": "video",
      "durationSeconds": 210, "whyRelevant": "...", "chapterLabels": ["..."] }
  ],
  "tourAvailable": { "id": "...", "title": "...", "stepCount": 3 }
}
```

**Backend responsibilities**
- Filter to `approved: true` first, then rank. An unapproved asset must never appear, regardless of relevance.
- Bias ranking by the stored visitor profile (persona, industry, depth) even when the agent does not pass those, so personalisation is not dependent on the agent remembering.
- Suppress assets already seen this session unless the agent asks to repeat.
- Surface `tourAvailable` when the matched assets belong to a tour, so the agent can offer the journey rather than a single clip.

---

## 3. `show_on_stage`

Push content to the stage. This is the tool that makes the product what it is.

**Agent-facing description**
> Display a catalog asset on the visitor's screen, or control what is already displayed. Say something in the same turn: introduce what they are about to see, or narrate what is happening. Never show something silently.

**Input**
```json
{
  "assetId": { "type": "string" },
  "action":  { "type": "string", "enum": ["show", "play", "pause", "seek", "highlight", "step", "clear"], "default": "play" },
  "position": { "type": "number", "description": "Seconds for seek, step index for step." },
  "cta": { "type": "array", "description": "Up to 4 suggested next actions.", "items": { "type": "object" } }
}
```

**Backend responsibilities**
- Re-check `approved: true`. Do not trust that `find_demo` filtered correctly.
- Resolve `source.url` into a playable URL, minting a short-lived signed URL when `requiresSignedUrl` is set. A long-lived private URL must never reach the client. Note that this is still needed under public-only content: an asset cleared for external use may still be privately hosted, for example on SharePoint. Public content and public hosting are separate problems.
- Emit the directive conforming to `contracts/stage-directive.schema.json`.
- Record the impression for telemetry.

---

## 4. `start_guided_tour` / `advance_tour`

**Agent-facing description (start)**
> Begin a curated multi-step journey. Offer it to the visitor first and get agreement; do not start one unannounced.

**Agent-facing description (advance)**
> Move to the next or previous step of the active tour, or resume it after a tangent. Returns the narration to deliver and pushes the step's asset to the stage.

**Input**
```json
// start_guided_tour
{ "tourId": { "type": "string" }, "useCase": { "type": "string", "description": "Alternative to tourId; backend selects the best tour." } }

// advance_tour
{ "direction": { "type": "string", "enum": ["next", "back", "resume", "exit"], "default": "next" } }
```

**Output**
```json
{ "tourId": "...", "title": "...", "step": 1, "totalSteps": 3,
  "narration": "...", "checkIn": "...", "assetId": "...", "isLastStep": false }
```

**Backend responsibilities**
- Hold tour position in session state, so a tangent does not lose the place.
- Push the step's stage directive as a side effect, so the agent cannot forget to.
- On `isLastStep`, include a suggested close so the tour ends deliberately rather than trailing off.

---

## 5. `update_visitor_profile`

**Agent-facing description**
> Record what you have learned about the visitor. Call this as soon as you learn anything, including details mentioned in passing. Pass only the fields you actually learned.

**Input**
```json
{
  "role": { "type": "string" },
  "persona": { "type": "string", "enum": ["cx-leader", "contact-center-ops", "it-architect", "developer", "procurement", "agent-supervisor"] },
  "industry": { "type": "string" },
  "companySize": { "type": "string" },
  "channels": { "type": "array", "items": { "type": "string" } },
  "incumbent": { "type": "string", "description": "Current vendor or platform if mentioned." },
  "pains": { "type": "array", "items": { "type": "string" } },
  "goals": { "type": "array", "items": { "type": "string" } },
  "timeline": { "type": "string" }
}
```

**Output**
```json
{ "profile": { }, "completeness": 0.4, "suggestedNextQuestion": "..." }
```

**Backend responsibilities**
- Merge, do not overwrite. Never drop a known field because this call omitted it.
- Return `suggestedNextQuestion` so discovery has direction without the agent having to plan it.
- **This is not the lead record.** Profile is behavioural and non-identifying. Name and email live only in the handoff record, created only with explicit consent.

---

## 6. `recommend_next`

**Agent-facing description**
> Get the best next content for this visitor given their profile and what they have already seen. Use this when a visitor finishes something and has not said what they want next.

**Input**
```json
{ "limit": { "type": "number", "default": 2 } }
```

**Output**
```json
{ "recommendations": [ { "assetId": "...", "title": "...", "reason": "..." } ],
  "suggestHandoff": false, "handoffRationale": "..." }
```

**Backend responsibilities**
- Combine the curated `followUps` graph with profile fit. Prefer curated edges over semantic similarity.
- Set `suggestHandoff` when engagement signals warrant it, for example three or more assets viewed, a technical depth question, or a stated timeline. Let the backend own this judgement rather than hoping the agent notices.

---

## 7. `request_handoff`

**Agent-facing description**
> Connect the visitor with a NiCE specialist. Use when they ask for a person, ask something you must not answer such as pricing, or have clearly seen enough to want a real conversation. Ask for their contact details explicitly and say what they will be used for before calling this.

**Input**
```json
{
  "reason": { "type": "string", "enum": ["pricing", "technical-deep-dive", "commercial", "visitor-requested", "out-of-scope"] },
  "mode":   { "type": "string", "enum": ["live-chat", "book-meeting", "send-followup"] },
  "contact": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "email": { "type": "string" },
      "company": { "type": "string" },
      "consentGiven": { "type": "boolean", "description": "Must be true. Set only after the visitor explicitly agreed to be contacted." }
    }
  },
  "summary": { "type": "string", "description": "What the visitor is trying to achieve and what they have seen." }
}
```

**Backend responsibilities**
- **Reject the call if `consentGiven` is not true.** Do not create a lead record. Return an error the agent can act on.
- `live-chat` routes into CXone Digital with transcript, profile and asset history attached, so the SE arrives informed. This is the highest-value path and the one that demonstrates the product.
- `book-meeting` returns real availability. Do not invent slots.
- Log the full session context against the lead so the SE does not start cold.
- GDPR: record consent timestamp and stated purpose. Support erasure by session id.

---

## Notes on tool count

Seven is close to the practical ceiling before selection accuracy degrades. If more
capability is needed, extend an existing tool's parameters rather than adding an eighth.

The riskiest tool for the model to get wrong is `show_on_stage`, because a wrong `assetId`
produces a confidently narrated but irrelevant demo. Mitigation: `show_on_stage` accepts
only ids returned by `find_demo` or a tour step in the current session, and rejects
anything else. Enforce this in the backend.
