# Catalog: what is done and what still needs a human

**30 assets catalogued.** All findable and playable by the agent. Regenerate with:

```bash
node tools/build-catalog.mjs
```

## Done

| | |
|---|---|
| Assets | 30 unique, from 32 files |
| Durations and sizes | Verified from disk |
| Chapters and talk tracks | **3 of 30** |
| Talking points | **3 of 30** |
| Approved for external use | **0 of 30** |

The three originals (Agent Copilot, Proactive Outreach, Supervisor Workspace) have full
chapters, talk tracks and talking points. The 27 NiCE World 2026 sessions have none.

## Two duplicates removed

Found by SHA256, not by guessing:

- `Screen Intelligence - Fuel CA AI beyond transcripts.mp4` is byte-identical to the `CX` version. `CA` is a typo.
- `MCP - Give Your AI Agents the Tools They Need.mov` is byte-identical to `The Interconnected Agentic World.mov`. I read the title card: the content is the **Interconnected Agentic World** keynote by Benjamin Mayr, so the MCP filename is simply wrong. **If you actually have a separate MCP session, it is missing from the drop.**

Both are excluded in `tools/build-catalog.mjs` via `skip: true`. Delete the redundant files when
convenient; the script handles them either way.

## What needs a human, in priority order

### 1. A content-governance problem in one session

`AI Agents: Build with Ease, Deliver at Scale` is a screen recording that captured the
presenter's **browser chrome**: their open tab bar and the address bar showing a personal
SharePoint URL under `niceonline-my.sharepoint.com/.../personal/shelby_sparrow_nice_com/...`.

That is visible in the first seconds of the video. It cannot go in front of a prospect as-is.
Either re-crop it, re-record it, or leave it unapproved.

I only sampled one frame of each of four sessions, so **assume others may have the same
problem** until someone has watched them. This is the single strongest argument for a real
review pass before anything is approved.

### 2. Approval

Everything is `approved: false`, which is why `PREVIEW_MODE = true` currently exists in the
Cognigy `find_demo` tool. Set that to `false` and the agent correctly finds nothing until
assets are cleared. Per asset:

```json
"approved": true,
"reviewedBy": "Olivier Attia",
"reviewedOn": "2026-08-31"
```

Then `node tools/validate-catalog.mjs`, which enforces that `approved: true` carries a reviewer
and a date.

### 3. Chapters, on the assets worth it

Not all 27 need them. Roughly 5.5 hours of conference content, and chaptering is manual.

Suggested priority, based on what a visitor is most likely to ask for:

1. `ai-agents-build-deliver-at-scale` (29:47) — the "how do I build one" answer, and the longest, so most in need of navigation
2. `interconnected-agentic-world` (21:16) — the architecture keynote
3. `supervisors-manage-human-and-ai` (11:13) — extends an already-strong story
4. The five industry sessions — a prospect in retail wants the retail moment, not 8 minutes
5. `orchestrating-customer-journeys` (23:08)

The others are fine played from the start.

For each, note three to six timestamps with a label and one sentence of what you would say
there, and paste it back in any format. I will convert it. I can also derive them by stepping
through the video as I did for the first three, but at roughly ten samples per video that is
slow for a 30-minute session, so telling me is faster if you already know the content.

### 4. Summaries and product names

The 27 summaries are derived from title cards and filenames, not from watching. Filenames have
already been wrong twice in this project, so treat them as drafts. The summary is what
retrieval matches a visitor's question against, so a corrected one is worth more than any
prompt tuning.

## Deferred

**File sizes.** Nine assets exceed 200 MB, and the set totals roughly 3.9 GB. Irrelevant while
this runs locally as a mockup, per your call. Recorded in `../docs/build-plan.md` under Phase 5
as a blocker on public exposure, not before.
