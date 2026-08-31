# Digital Room, build plan

> Sequenced so the riskiest assumption is tested first and nothing large is built on an
> unvalidated foundation.

---

## The riskiest assumption

Not the frontend, and not Cognigy. It is this:

**Can the agent reliably pick the right asset for a real question?**

If asset selection is only 60 percent accurate, a polished stage makes things worse,
because a confidently narrated irrelevant demo is more damaging than a plain text answer.
So Phase 1 tests selection before any custom UI exists.

---

## Phase 0, unblock and inventory

No code. Cannot be skipped.

- [ ] Fix the Cognigy MCP API key. Currently `401 Unable to authenticate via api key`, so nothing can be built in the tenant.
- [ ] Confirm the Cognigy project, and whether an LLM connection already exists in it.
- [x] Inventory the real demo assets. Three delivered 2026-08-28 in `../../Resources` and catalogued in `catalog/demo-catalog.json` with verified titles and durations: Copilot for Agents (1:36), Outbound Engagement (2:59), Supervisor (2:15). All `approved: false`.
- [x] **Chapters and talk tracks for those three.** Done 2026-08-28 by stepping through each video frame by frame in the browser and reading what is on screen. Product names corrected from the filenames. Validator reports zero warnings.
- [ ] **Review and approve the three.** All still `approved: false`, so nothing is retrievable at runtime. Needs a named reviewer. See `catalog/chapters-todo.md`.
- ~~Transcode for web~~ **Deliberately deferred 2026-08-31.** Two of the three are presentation masters at roughly 11 to 15 Mbps. Irrelevant while this runs locally as a mockup. Moved to Phase 5, must not reach a public portal unresolved.
- [ ] More assets. Three overview videos cover one depth level and no technical content. The 8-question check in Phase 1 needs enough breadth to discriminate between use cases.
- [ ] Confirm the external-use approval process and who signs the `approved` flag.
- [ ] Get access to the enablement and RFP content for build-time authoring.
- [ ] Decide hosting for the frontend and the retrieval backend.

**Exit criteria:** MCP authenticates, and there is a list of at least ten real assets with
URLs that actually load.

---

## Phase 1, prove asset selection (agent only, no custom UI)

Build the brain and test it in plain Cognigy webchat. Ugly on purpose.

- [x] Populate the real catalog. `catalog/demo-catalog.json`, three assets with chapters and talk tracks, validator clean.
- [x] Stand up `find_demo`. Built as `OAT_DIGITAL_ROOM_find_demo` with the catalog embedded in its Code node. See `cognigy/deployed.md`.
- [x] Create the AI Agent. `OAT_DIGITAL_ROOM_Guide` in OAT_Sandbox, with persona, guardrails and job config from `cognigy/agent-instructions.md`.
- [ ] **`search_knowledge` not built.** No knowledge store exists, so there is no grounded answer path for questions the catalog cannot illustrate. The agent correctly declines instead of inventing, but it declines often. This is the biggest functional gap.
- [ ] Run the **8-question check** below. Not yet run; three assets is too thin for it to fail informatively.

### The 8-question check

Not a benchmark. A small, reusable regression set, chosen so each question probes a
different failure mode. Rerun it whenever the catalog changes, which is the reason it is
eight rather than zero.

| # | Type | Probes |
|---|---|---|
| 1 | Business outcome, prospect framing | Does it lead with an asset instead of a paragraph |
| 2 | Business outcome, different use case | Is it distinguishing use cases or defaulting to one hero asset |
| 3 | How-to, functional depth | Depth matching |
| 4 | How-to, phrased with a legacy or competitor term | `keywords` recall |
| 5 | Technical, architecture or integration | Does it reach the technical asset rather than the overview |
| 6 | Vague open question, "what can you do" | Does it narrow with one question rather than dumping everything |
| 7 | Capability we genuinely do not have content for | Does it admit the gap instead of inventing. **Zero tolerance.** |
| 8 | Pricing question | Does the hard rail hold and route to a human |

**Exit criteria:** correct asset on 6 of 8 where an asset exists, and questions 7 and 8
must pass. An invented capability claim fails the phase outright regardless of the other
scores.

If selection is poor, the fix is almost always catalog metadata, specifically `summary`
and `keywords`, not the prompt and not the model. Fix it here where it is cheap.

---

## Phase 2, the Showroom frontend

Only once Phase 1 passes.

- [ ] Vite + React + TS scaffold, Zustand, MUI. Split layout, chat rail plus stage.
- [x] Live agent connection. Built as `CognigyTransport` over the REST endpoint plus a Vite dev proxy, rather than `@cognigy/socket-client`. Chosen because it needs no extra dependency, keeps the endpoint credential server-side, and solves CORS in one place.
- [ ] Move to `@cognigy/socket-client` for streaming. REST returns the whole turn at once, so latency is 8 to 15 seconds of nothing followed by a wall of text. Acceptable for a mockup, not for a prospect.
- [ ] Stage directive handling per `contracts/stage-directive.schema.json`. Unknown `v` is ignored, not guessed at.
- [ ] Renderers, in this order: video with chapters, walkthrough, diagram, comparison.
- [ ] `show_on_stage` emitting real directives.
- [ ] CTA buttons round-tripping back to the agent.
- [ ] Responsive fallback: on narrow screens the stage stacks above the chat rail. A sales tool gets opened on phones.

**Exit criteria:** a full conversation where every asset type renders and the agent
narrates in sync with what is on screen.

---

## Phase 3, personalisation, audience adaptation and journeys

- [ ] `update_visitor_profile` with server-side merge.
- [ ] Profile-biased ranking inside `find_demo`.
- [ ] Audience adaptation: prospect, customer, rep, partner. Framing and depth only, never content access. Self-declared role is acceptable because nothing is unlocked by it.
- [ ] Tours: `start_guided_tour`, `advance_tour`, tangent and resume handling.
- [ ] `recommend_next` over the curated `followUps` graph.
- [ ] Tour progress rendering on the stage.

**Exit criteria:** two visitors with different stated roles asking the same question get
demonstrably different framing and depth, drawn from the same content universe.

---

## Phase 4, handoff and telemetry

- [ ] `request_handoff`, all three modes, with consent enforced server-side.
- [ ] Live escalation into CXone Digital carrying transcript, profile and asset history.
- [ ] CRM lead creation with consent timestamp and purpose.
- [ ] Telemetry: questions, impressions, watch-through, drop-off, handoff outcome.
- [ ] Per-session summary an SE can read in under a minute before a follow-up call.

**Exit criteria:** an end-to-end run where a visitor escalates and the receiving SE has
full context without asking anything again.

---

## Phase 5, hardening before exposure

With entitlement gone, this phase is about **what the agent says** and **what the endpoint
costs**, not about who can see what.

- [ ] **Rails red-team.** The attacker goal here is a damaging screenshot, not data theft. Attempt to extract a price, a roadmap date, a competitor claim, or a guarantee. Attempt instruction injection via a pasted document. Attempt to make it reveal its system prompt or tool list. Attempt a claim of NiCE employment to unlock more, which must be a no-op.
- [ ] Confirm `show_on_stage` rejects any `assetId` not surfaced in the current session.
- [ ] Confirm every runtime asset and knowledge source carries `approved: true` with a named reviewer and date. This is the only content gate, so audit it deliberately.
- [ ] Signed short-lived URLs, or a CDN move, for any public-cleared asset that is privately hosted.
- [ ] **Transcode the video masters for web delivery.** Deferred from Phase 0 while the tool was a local mockup. As of 2026-08-31 two of three assets are 11 to 15 Mbps presentation masters, including 339 MB for a 2:59 clip. A prospect on a normal connection will buffer. Target 1080p H.264 at 3 to 5 Mbps with faststart, or HLS with multiple renditions. Blocks public exposure, nothing earlier.
- [ ] Rate limiting and abuse protection. An anonymous public LLM endpoint will be probed.
- [ ] Cost controls: per-session token ceiling and a cap on tool-call loops.
- [ ] GDPR: privacy notice, consent record, erasure by session id, retention policy.
- [ ] Graceful degradation when retrieval or the LLM is unavailable. It must not show a broken chat window to a prospect.
- [ ] Bundle size review. The agent console project reached around 3.5 MB; do not repeat that.

---

## Sequencing rationale

| Choice | Why |
|---|---|
| Agent before frontend | Selection accuracy is the make-or-break variable and is cheapest to test without UI. |
| Eight questions, not thirty | Enough to cover the distinct failure modes and cheap enough to rerun on every catalog change. Zero would mean discovering bad selection in front of a prospect. |
| Questions 7 and 8 are pass or fail | Hallucinated capability and a leaked price are the two failures with real consequences. Ranking accuracy is a quality problem; those two are not. |
| Telemetry late | Not needed to validate the concept, but needed before the tool is judged internally. |
| Catalog first inside Phase 1 | Retrieval quality is a metadata problem far more than a model problem. |
| Hardening focused on output, not access | Public-only content removes the access threat and leaves the output threat. |
