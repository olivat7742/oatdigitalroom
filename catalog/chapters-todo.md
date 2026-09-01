# Catalog: what is done and what still needs a human

**39 assets.** All findable and playable by the agent. Regenerate with:

```bash
node tools/build-catalog.mjs
```

```bash
pwsh tools/fetch-youtube.ps1
```

## State

| | Count | Notes |
|---|---|---|
| Total assets | 39 | |
| Local video files | 31 | Unapproved NiCE masters, not in the repo |
| YouTube embeds | 8 | Public on NiCE's channel |
| **Approved for external use** | **8** | All YouTube. Every local file is still `approved: false` |
| Chapters and talk tracks | 4 | All local. Embeds cannot have chapters |

## The two content classes now differ in a way that matters

**YouTube embeds are shippable today.** They are already published publicly by NiCE, so the act
of publishing *is* the external-use clearance. They also render on the public Pages build, which
means the shareable link finally plays real content. Approval is attributed to the channel
rather than to a person, so it stays auditable.

**Local files are not shippable.** They are internal masters. Nothing changes there until
someone reviews them.

Embeds cannot be chapter-jumped: the host page cannot read an iframe's playback position, so
`position` only applies as a start offset when the frame loads. The validator enforces this
rather than letting someone add chapters that would silently never fire.

## What needs a human, in priority order

### 1. A content-governance problem in one local session

`AI Agents: Build with Ease, Deliver at Scale` is a screen recording that captured the
presenter's **browser chrome**: their open tab bar and the address bar showing a personal
SharePoint URL under `niceonline-my.sharepoint.com/.../personal/shelby_sparrow_nice_com/...`.

Visible in the first seconds. It cannot go in front of a prospect as-is. Re-crop it, re-record
it, or leave it unapproved.

I only sampled a frame or two from a handful of these sessions, so **assume others may have the
same problem** until someone has watched them.

### 2. Approve the local files, or don't

All 31 local assets are `approved: false`, which is why `PREVIEW_MODE = true` exists in the
Cognigy `find_demo` tool. Set it to `false` and the agent will correctly show only the 8
YouTube assets. Per asset:

```json
"approved": true,
"reviewedBy": "Olivier Attia",
"reviewedOn": "2026-08-31"
```

Then `node tools/validate-catalog.mjs`, which enforces that `approved: true` carries a reviewer
and a date.

### 3. Chapters, on the local assets worth it

Not all 27 unchaptered local files need them. Roughly 5.5 hours of conference content.

Priority, based on what a visitor is most likely to ask for:

1. `ai-agents-build-deliver-at-scale` (29:47) — the "how do I build one" answer, and the longest, so most in need of navigation
2. `interconnected-agentic-world` (21:16) — the architecture keynote
3. `supervisors-manage-human-and-ai` (11:13) — extends an already-strong story
4. The five industry sessions — a prospect in retail wants the retail moment, not 8 minutes
5. `orchestrating-customer-journeys` (23:08)

For each, note three to six timestamps with a label and one sentence of what you would say
there, and paste it back in any format.

### 4. Curation review on the YouTube set

I included 8 of the 15 videos on the feed and excluded 7, with reasons recorded in
`YOUTUBE_META` in `tools/build-catalog.mjs`. Excluded: six NiCE TV analyst and partner
interviews, and the Kristen Bell brand ad. My reasoning is that the Digital Room exists to show
how the technology works, and an interview does not. Overrule any of them by removing `skip`.

### 5. The feed only returns 15 videos

`tools/fetch-youtube.ps1` uses the public Atom feed, which caps at the 15 most recent. The
channel has more. The full history needs a YouTube Data API v3 key, passed via a
`YOUTUBE_API_KEY` environment variable, never committed. Say the word and I will wire it.

I did try scraping the channel HTML first: one request returned 1.1 MB with parseable data and
the next returned 570 KB without, so it is not a reliable basis for a build step.

## Deferred

**Local file sizes.** Nine assets exceed 200 MB, and the local set totals roughly 3.9 GB.
Irrelevant while this runs locally as a mockup, per your call. Recorded in
`../docs/build-plan.md` under Phase 5 as a blocker on public exposure of the local files. The
YouTube embeds are unaffected, since YouTube handles their delivery.
