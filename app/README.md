# Digital Room, Showroom frontend

Split-screen showcase: chat rail plus stage. Runs against either fixtures or the live
Cognigy agent.

## Transports

`VITE_TRANSPORT` in `.env.local` selects which:

| Value | Behaviour |
|---|---|
| `cognigy` | Talks to the real `OAT_DIGITAL_ROOM_Guide` agent through the dev proxy. Currently set. |
| anything else | Fixture-driven mock mode, no backend, no model. |

Live mode needs `COGNIGY_ENDPOINT_URL` set in `.env.local`. That value is a **credential**:
the URL token in it is all anyone needs to talk to your agent and spend your LLM budget. It
is deliberately not `VITE_`-prefixed, so Vite keeps it server-side and the dev server proxies
`/api/cognigy` to it. It never reaches the browser bundle. See `.env.example`.

**Restart the dev server after changing `.env.local`.** Vite reads env at startup.

```bash
npm install
```
```bash
npm run dev
```

Then open the URL Vite prints, by default `http://localhost:5180`.

## What mock mode is for

Phase 2 of `../docs/build-plan.md` depends on the Cognigy agent, which is not live yet. Mock
mode lets the entire stage experience be built and reviewed first, so that when the agent
arrives there is something real to point it at.

`MockTransport` is a scripted keyword matcher, not a model. It exists to exercise every
stage renderer and every directive action.

Try these in the chat to hit each renderer:

| Say | Exercises |
|---|---|
| "How do you help agents during a conversation?" | Real video, Copilot for Agents |
| "What does the supervisor experience look like?" | Real video, Supervisor |
| "How does outbound engagement work?" | Real video, Outbound Engagement |
| "Skip to the middle" | `seek` directive, verified against HTTP range requests |
| "How do I build an AI agent?" | Walkthrough with hotspots and step navigation |
| "How does this integrate with my stack?" | Diagram renderer |
| "Give me the guided tour" | Tour progress rendering |
| "How much does it cost?" | The pricing rail and a handoff CTA |

## Media

The three videos are **real files**, read from `../../Resources` and described by
`../catalog/demo-catalog.json`. They are served by a dev-only middleware in `vite.config.ts`
at `/media/`, with HTTP range support so the browser can seek, and a traversal guard so the
route cannot escape the media root.

They are deliberately not copied into the project. They total roughly 500 MB and the source
directory is in OneDrive, so duplicating them would double that inside a synced folder.
Override the location with `SHOWROOM_MEDIA_ROOT` if it moves.

Production will not use this middleware. Assets belong on a CDN, which is still an open item
in `../docs/solution-design.md`.

Walkthrough and diagram assets are still generated placeholders watermarked **MOCK ASSET**,
because no real assets of those types exist yet.

**The real videos have no chapters.** That is the highest-value missing metadata in the
project, and it needs someone who has watched them. See `../catalog/chapters-todo.md`.

Validate the catalog after any edit:

```bash
node tools/validate-catalog.mjs
```

## Header personalisation

Once the agent identifies the visitor, their company logo appears in the middle of the header.
The NiCE wordmark stays top left and the header height never changes: the logo is capped at
26px tall and 150px wide with `object-fit: contain`, so a wide wordmark scales down rather than
stretching the row.

The logo is resolved from the **email domain**, never the company name. `app/src/company.ts`
explains why, and carries the personal-provider blocklist that stops a Gmail user being shown
Gmail's logo as their employer's.

The identity reaches the client as `data._visitor`, a deliberate **sibling** of `_showroom`
rather than part of it: it says nothing about what is on the stage, and the Stage has no
business knowing who is watching. Contract: `../contracts/visitor-payload.schema.json`.

## The closing summary

When the visitor signals they are done, the agent calls `wrap_up` and the stage switches to a
summary: what they watched, checkboxes of topics to explore, and three follow-up offers.

Three things about it are deliberate:

**It does not end the conversation.** The chat rail stays live and any later demo replaces the
panel. Someone who says "bye" and then thinks of one more question should not have to start
over, which is why the directive is `wrapup` rather than anything that closes a session.

**The recap is built from what was actually shown**, not from the model's recollection. The
Cognigy `show_demo` tool appends each played assetId to `context.digitalRoomViewed`, and
`wrap_up` reads that list back. Asking the model to remember its own session would produce a
confident and occasionally wrong list.

**A captured email is not consent to send one.** The address was given so the visitor could be
followed up *if they asked*. Using it because we have it would be a different purpose from the
one they were told, so the opt-in checkbox is the consent, and the send button stays disabled
until it is ticked.

Every action round-trips through the agent as an ordinary message rather than calling a tool
directly, so the transcript remains the single record of what was agreed.

## Citations and further reading

Every agent reply carries somewhere to go for more detail, in three layers:

1. **The asset it showed**, cited by name. A real link where the asset has a public address, which today means the YouTube ones.
2. **Product references** from the catalog's `references`, generated from the asset's products.
3. **Fallback references** when a reply shows nothing at all, including a pricing refusal or "there is no demo of that". Those are exactly the replies where a visitor most wants another route.

**Local assets deliberately get no link.** They are served from the dev media route, which
means nothing on anyone else's machine. A citation that dies the moment it is bookmarked is
worse than none, so those say "no public link yet" instead. Give one a `source.watchUrl` in the
catalog and it becomes a link automatically.

Every reference URL was verified to return 200 rather than constructed: two plausible-looking
guesses 404'd while authoring the map. Re-check after any NiCE site reorganisation:

```bash
pwsh tools/check-links.ps1
```

## Design rules this code follows

**The Stage is a thin renderer.** It holds no product logic and decides nothing about what
to show. It receives typed directives and renders them. All intelligence lives in the agent
and its tools. Every new directive action is a permanent frontend obligation, so the
contract in `../contracts/stage-directive.schema.json` is kept deliberately narrow.

**Unknown contract versions are ignored, not guessed at.** See `extractDirective` in
`src/types/stageDirective.ts`. Rendering a confident wrong thing is the specific failure
this product cannot afford.

**Talk tracks are rendered client-side.** When playback crosses a chapter boundary, the
`talkTrack` already present in the directive is displayed. That is rendering authored
content on cue, not generating it, so the thin-renderer rule holds. Round-tripping to the
agent on every chapter would add latency and token cost for text the catalog already
decided.

**Video works without video.** With no resolved media source, playback falls back to a
synthetic clock, so chapters and narration timing stay reviewable for assets that do not
exist yet. The three real videos use the actual `<video>` element; the fallback still covers
any catalog entry whose URL is unresolved.

## Swapping in the real agent

`src/transport/types.ts` defines the seam. Add `CognigyTransport` implementing `Transport`
over `@cognigy/socket-client`, then change the one line in `App.tsx` that constructs
`MockTransport`. Nothing else should need to move.

## Branding

`src/theme.ts` uses real NiCE tokens, read from the live CSS custom properties on nice.com
rather than guessed at:

| Token | Value | Used for |
|---|---|---|
| `--black` | `#22212b` | Text, stage surround, handoff CTA |
| `--primary` | `#3694fd` | Primary actions, progress, visitor bubbles |
| `--darkblue` | `#2c79ee` | Hover states |
| `--gray` | `#f2f0eb` | Page background |
| `--darkbase` | `#e8e6e0` | Agent bubbles, empty states |
| `--darkgray` | `#6d6d72` | Secondary text |
| `--red` | `#ff5b8a` | Narration accent, mock-mode marker |
| `--green` | `#00e2a0` | Walkthrough hotspots |

Typeface is **Be Vietnam Pro**, matching nice.com: weight 300 body, 500 headings, negative
tracking on headings, and full-pill buttons at the site's 38px radius.

Two deliberate departures from a literal copy of nice.com:

- **The stage is dark** (`#22212b`) while the page is light. Video needs a dark surround to read properly. Using NiCE's own black keeps that on brand rather than introducing a neutral outside the palette.
- **No logo file.** The header uses a styled text wordmark. The real logo is governed by brand guidelines covering approved files, clear space and minimum sizes, so it should come from the brand team rather than be lifted off the marketing site. To add it: save the approved SVG to `src/assets/nice-logo.svg` and swap the `Typography` in `Wordmark()` in `src/App.tsx` for an `<img>`.

## Known gaps

- **Be Vietnam Pro loads from Google Fonts.** Fine for development. Self-host it for production: it is a third-party dependency on the critical render path and, for an EU-facing page, a data transfer worth avoiding.
- No telemetry, no handoff, no profile. Those are Phases 3 and 4.
