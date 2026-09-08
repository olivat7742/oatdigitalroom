# Catalog: what is done and what still needs a human

**90 assets.** All findable and playable by the agent. Regenerate with:

```bash
node tools/build-catalog.mjs
```

```bash
pwsh tools/fetch-youtube.ps1
```

## State

| | Count | Notes |
|---|---|---|
| Total assets | 90 | |
| Local video files | 55 | Unapproved NiCE masters, not in the repo |
| YouTube embeds | 8 | Public on NiCE's channel |
| nice.com documents | 27 | Public on nice.com |
| **Approved for external use** | **46** | The 8 embeds, the 27 documents, and the 11 NiCE World vertical demos cleared on 2026-09-08 |
| Local files still unapproved | 44 | The NiCE World conference sessions, the retail set, and NiCE Homes |
| Chapters and talk tracks | 28 | All local. Embeds cannot have chapters |
| Verbatim talking points | 12 | Claims transcribed from the asset itself, not written |

The media directory is now walked **recursively**: the NiCE World vertical assets arrived filed
one folder per industry, and a flat listing found none of them and said nothing about it. META
in `tools/build-catalog.mjs` is keyed by the path relative to the media root, so
`NiCE World - Vertical Assets/FSI/Voice_FSI.mp4` is a key. Nothing was needed on the serving
side: the dev server already resolves any relative path under the media root, behind a
traversal guard, and range requests work on the nested paths (checked, so seeking works).

## Three content classes, and they clear differently

**YouTube embeds are shippable today.** They are already published publicly by NiCE, so the act
of publishing *is* the external-use clearance. They also render on the public Pages build, which
means the shareable link finally plays real content. Approval is attributed to the channel
rather than to a person, so it stays auditable.

**nice.com documents clear the same way,** by already being public, and are attributed to
nice.com/resources rather than to a person.

**Local files need a named human, and eleven now have one.** The NiCE World vertical demos were
reviewed and cleared by the content owner on 2026-09-08, so they are the first local assets
attributed to a person rather than to an act of publication. See item 0. The remaining 44 local
files are still internal masters and nothing changes there until someone reviews them.

Embeds cannot be chapter-jumped: the host page cannot read an iframe's playback position, so
`position` only applies as a start offset when the frame loads. The validator enforces this
rather than letting someone add chapters that would silently never fire.

## What needs a human, in priority order

### 0. The eleven NiCE World vertical assets: reviewed and approved, 2026-09-08

**Status: approved for external use.** All eleven carry `approved: true`, `reviewedBy: Olivier
Attia`, `reviewedOn: 2026-09-08`. They are the first local files in the room to be cleared.

This is recorded rather than deleted because approval is the only content gate in this system
and it has to stay auditable. What was checked, and what was decided:

**What was found.** These are screen recordings of a working laptop and phone, so the machine
is in shot as well as the demo. Frame extraction found on-screen message history, mobile
numbers, app notification badges, a browser profile photo, the Windows taskbar and clock, and
Cognigy project and flow object ids in the address bar. Frames worth re-checking if this is
ever revisited: `Government/Cognigy Chat.mp4` ~3m12, `Government/Voice Cognigy.mp4` ~2m50 and
~5m00, `Government/Government Cognigy Chat, Copilot for Agents.mp4` ~3m20, both FSI files
throughout, `Government/Voice Copilot.mp4` 0m04 and 3m27, `Healthcare/NWL healthcare.mp4`
~1m00. Specifics are deliberately not written out here: this repository is public.

**What was decided.** Raised as a blocker, and cleared by the content owner: the personal
information visible on screen is demo data, not a real person's. That is the owner's call to
make and it is what the review fields now record.

**Two things left over, neither blocking.**

1. **Cognigy project and flow object ids are visible in the address bar of both FSI files.**
   Those are tenant identifiers rather than personal data, and this project keeps them out of
   version control on purpose. Low risk in front of a prospect, who cannot do anything with
   them, but worth a decision if these ever go somewhere public and indexable.
2. **`Government/Government Cognigy Chat, Copilot for Agents.mp4` at ~3m20** appears to have
   the browser on a genuine `*.service.gov.uk` host with real Crown and Open Government Licence
   marks. If a demo really is driving a live government service, that is worth knowing
   deliberately rather than by accident. Everything else in that file is the fictional
   UK Work & Support Service.

**Still to do to make these actually reachable:** see item 2. Approval alone is not enough,
because `PREVIEW_MODE = true` in `cognigy/code-nodes/search-catalog.js` currently ignores the
approved flag entirely.

### 0b. What the retail set and the vertical assets actually contain

The summaries in `META` **have** now been checked against the recordings, frame by frame. Three
findings that changed the metadata rather than just confirming it:

1. **Clip 8 was mislabelled by its own filename.** "CXone Actions" reads as workflow automation
   and that is what the catalog said. It is actually unified BI with natural-language querying,
   plus Automated Insights sizing automation opportunities from real conversation patterns and
   creating a Cognigy agent from one. Now corrected, and asserted in
   `tools/test-retrieval.mjs` so it cannot silently drift back.
2. **The two long retail cuts are not the same walkthrough twice.** They share the first six
   minutes exactly, then diverge completely: the 24-minute cut goes to evaluations, supervisor,
   performance dashboards and a coaching focus board; the narrated 20-minute cut goes to
   Interactions Hub, Copilot config, quality auto-scoring, analytics and the Automation
   Opportunity view. Both are worth keeping, and they are now titled by the thing a visitor
   actually chooses between: length, and whether it is narrated.
3. **Most of this content is silent, measured rather than assumed.** The eight numbered retail
   clips, the 24-minute cut, `NWL Chat end to end`, `Digital FSI]` and both government chat
   files all carry an audio stream that is digitally empty at -91 dB. `NWL healthcare` has **no
   audio stream at all**. Only `Retail: the narrated 20-minute walkthrough` has a real narrator;
   the voice demos have sound because you hear the call. So most of these cannot be left playing
   unattended, and each summary says so. The eight retail clips compensate with burned-in
   narration captions, and those captions are NiCE's own claims, transcribed verbatim into
   `talkingPoints` with `chapters` marking where each appears.

**Two quantified claims are now in the catalog, in NiCE's own words:** 15-25% AHT reduction
(retail clip 2) and 100% interaction coverage against an industry average of 1-3% (clip 6).
They were transcribed, not invented. But they are marketing claims on unapproved assets, and
approving those assets approves the agent quoting them, so decide that deliberately.

### 0c. Two smaller decisions

1. **Does real estate deserve a vertical?** `homes-property-management` carries **no**
   `industries` value. `catalog/industries.json` deliberately maps real estate, rental and
   property management to null rather than forcing them into the nearest-looking box, so the
   room now holds a real-estate demo that no vertical shortcut reaches. It is reachable by
   keyword, verified against the real `searchCatalog` and locked in by two cases in
   `tools/test-retrieval.mjs`. Adding a thirteenth vertical is a bigger decision than this one
   asset, since the twelve are NiCE's own filter set on nice.com/resources and the slug
   deep-links to it. Your call.
2. **A scoring wrinkle worth knowing about, now that 28 assets have chapters.** `searchCatalog`
   adds a flat `+0.5` to any asset with chapters. A document can never have chapters, so it can
   never earn it. Adding these 24 chaptered videos put a fictional utilities demo above the
   Helen customer story on "show me a utilities customer using agentic AI" by a margin of
   **0.05**, entirely on that bonus. It was fixed here by keeping one word out of one title,
   which is a patch, not a fix. The real question is whether that nudge should compare like with
   like. It is not changed in this pass because the same scoring is mirrored in the Cognigy
   `find_demo` tool, so changing it changes the live agent too.

`homes-property-management` is also **507 MB for 5:15**, the heaviest asset per minute in the
set and the largest single file. See Deferred at the bottom.

Filename nit, in case these get re-exported: `FSI/Digital FSI].mp4` has a stray closing bracket,
and the `Retail and Travel` folder is empty.

### 1. A content-governance problem in one local session

`AI Agents: Build with Ease, Deliver at Scale` is a screen recording that captured the
presenter's **browser chrome**: their open tab bar and the address bar showing a personal
SharePoint URL under `niceonline-my.sharepoint.com/.../personal/shelby_sparrow_nice_com/...`.

Visible in the first seconds. It cannot go in front of a prospect as-is. Re-crop it, re-record
it, or leave it unapproved.

I only sampled a frame or two from a handful of these sessions, so **assume others may have the
same problem** until someone has watched them.

### 2. Turn PREVIEW_MODE off, which is what makes approval mean anything

**This is now the blocking item, and it is a one-line change in the tenant.**

`PREVIEW_MODE = true` in `cognigy/code-nodes/search-catalog.js` line 16 makes the search pool
ignore the `approved` flag completely, so the agent currently offers all 90 assets regardless.
Approving the eleven vertical demos changed nothing about what the live agent will show until
that constant is `false`.

Set it to `false` and the agent shows the 46 approved assets: the 8 YouTube embeds, the 27
nice.com documents, and the 11 NiCE World vertical demos. That is a genuinely good room. It
loses the 44 unapproved local files, which includes the whole retail set, so the tradeoff is
real and it is a judgement call about who the room is for.

Not changed here, because it is a deliberate behaviour change to the live agent rather than a
consequence of adding content, and because the Code node has to be edited in the Cognigy
tenant and redeployed, not just committed.

To approve more local files, per asset in `catalog/demo-catalog.json`:

```json
"approved": true,
"reviewedBy": "Olivier Attia",
"reviewedOn": "2026-09-08"
```

Then `node tools/validate-catalog.mjs`, which enforces that `approved: true` carries a reviewer
and a date. These three fields are prior-wins in `tools/build-catalog.mjs`, so regenerating the
catalog keeps them. One side effect worth knowing: once `reviewedBy` is set, that asset's
`summary` is also taken from the catalog rather than from META, so a reviewed summary cannot be
silently rewritten by a later build. Edit those summaries in the catalog, not in META.

### 3. Chapters, on the local assets worth it

27 local files are still unchaptered, all of them NiCE World conference sessions, roughly 5.5
hours. Every one of the 24 retail, Homes and vertical assets now has chapters with talk tracks,
written from the recordings.

Priority, based on what a visitor is most likely to ask for:

1. `ai-agents-build-deliver-at-scale` (29:47) — the "how do I build one" answer, and the longest, so most in need of navigation
2. `interconnected-agentic-world` (21:16) — the architecture keynote
3. `supervisors-manage-human-and-ai` (11:13) — extends an already-strong story
4. The five industry sessions — a prospect in retail wants the retail moment, not 8 minutes
5. `orchestrating-customer-journeys` (23:08)
Two **tours** are now the obvious next thing, since a tour is the catalog's mechanism for a
sequence and both of these already exist as sequences:

- The eight numbered retail clips, in the vendor's own order, which is a complete
  product-by-product story with the chapters and talking points already written.
- The vertical set, as one tour per industry: self-service, then the agent with Copilot, then
  voice where it exists. That is the shape of a real vertical conversation.

Neither is written here. A tour also carries a `checkIn` question per step, and what to ask a
visitor after each clip depends on who is in the room, which is your judgement rather than
something derivable from the recordings. Say the word and they are quick to add.

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

**Local file sizes.** Thirteen assets exceed 200 MB, and the local set totals roughly 5.9 GB.
The retail set added 1.2 GB of it, over a third of that in `homes-property-management` alone,
and the vertical assets another 0.8 GB, half of that in `NWL healthcare` which is 386 MB for
nine minutes because it is encoded at 5.8 Mbps. Irrelevant while this runs locally as a mockup,
per your call. Recorded in
`../docs/build-plan.md` under Phase 5 as a blocker on public exposure of the local files. The
YouTube embeds are unaffected, since YouTube handles their delivery.
