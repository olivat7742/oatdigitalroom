# Chapters and talk tracks: done, pending your review

**Status: chapters, talk tracks, talking points, summaries and product names are now in
`demo-catalog.json` for all three videos.**

## How they were produced

Not guessed. I loaded each video in the browser, stepped through it frame by frame using the
dev media route, and read what was actually on screen. Roughly ten sample points per video,
plus tighter sampling around transitions.

That means the timestamps correspond to real scene changes and the talk tracks describe
things genuinely visible in the frame. It does **not** mean I heard the voiceover. I read
screens, on-screen titles and UI state, not audio. If the narration makes a point that never
appears on screen, I will have missed it.

## Corrections I made to the catalog

The filenames were misleading in two of three cases:

| Filename says | The video says |
|---|---|
| NiCE Copilot for Agents | **CXone Agent Copilot** |
| Outbound Engagement | **NiCE Proactive Outreach**, administered in **SmartReach** |
| Supervisor | **CXone Supervisor Workspace** |

Three things the filenames gave no hint of, and which materially change how these should be
pitched:

1. **The Copilot video is an insurance new-business use case.** A life insurance application on a live voice call, with Salesforce record creation and a DocuSign e-signature request. It is a vertical demo, not a generic overview. I tagged it `insurance` and `financial services`.

2. **The outbound video contains Cognigy.** The last third shows the outbound voice AI agent being authored and live test-called in Cognigy, with instructions, memory handling, grounding knowledge and tool calls visible. That makes it the only technical-depth asset in the catalog, and it is tagged `depth: technical` accordingly.

3. **The supervisor video is about supervising AI agents**, not just human ones. AI agents are listed like staff with per-agent containment, quality score, sentiment and escalation rate, and failing conversations are flagged with a detected reason such as a conversation loop. This is the strongest differentiator in the three videos and the filename hides it completely.

## What I need from you

**1. Sanity-check the talk tracks.** You know these products and I inferred intent from
frames. Anything that overclaims or misreads a screen, tell me and I will fix it. Particular
attention to the Copilot video around 0:25 to 0:50, where I interpreted the App Space cards
as Copilot acting autonomously rather than the agent triggering them.

**2. Approve, or do not.** All three are still `approved: false`, so nothing is retrievable at
runtime. Watching a video is not the same as clearing it for external use, and that decision
needs a named human. When you are ready, per asset:

```json
"approved": true,
"reviewedBy": "Olivier Attia",
"reviewedOn": "2026-08-31"
```

Then re-run the validator, which enforces that `approved: true` carries a reviewer and a date:

```bash
node tools/validate-catalog.mjs
```

**3. One thing to check carefully before approving.** The on-screen figures are demo data:
82% containment, 78% quality score, 156 escalations, 28 active AI agents, "voicemail detection
averages under 90%". I wrote the talk tracks to avoid presenting any of these as product
benchmarks, and added an explicit talking point on each asset saying the data is a demo
environment. Worth confirming that framing is enough for your compliance people, because a
prospect screenshotting "82% containment" as a NiCE commitment is a real risk on a
self-service tool.

## File size: deferred, not forgotten

Two of the three are 11 to 15 Mbps presentation masters, including 339 MB for a 2:59 clip.
Deliberately ignored as of 2026-08-31 because this runs locally as a mockup, where it costs
nothing. Recorded in `../docs/build-plan.md` under Phase 5 as a blocker on public exposure.

## Also outstanding: coverage

Three videos is thin for the Phase 1 selection check. You now have one technical asset (the
Cognigy portion of the outbound video) and two functional ones, but no self-service or
containment demo, and nothing for `it-architect` beyond that one segment. The 8-question check
cannot properly test use-case discrimination on three assets.
