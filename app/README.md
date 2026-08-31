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
