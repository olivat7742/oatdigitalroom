# Digital Room

An agentic, self-service interactive showcase for NiCE CXone and Cognigy.

A visitor asks sales, how-to or technical questions. An AI guide answers in a grounded way
and pushes matching content onto a stage: video with chapters, clickable walkthroughs,
architecture diagrams. A dynamic guided demo rather than a static demo library.

Audiences: prospects, existing customers, NiCE sales reps, NiCE partners. All four see the
same content, which is public and approved for external use. Audience changes framing and
depth only.

## Try it

**https://olivat7742.github.io/oatdigitalroom/**

Published from `main` on every push. Ask it about helping agents, supervisors, or outbound.

What you are looking at is the **architecture**, not the content. This build runs the fixture
transport and has no video: the demo videos are unapproved NiCE marketing masters and are not
in this repository, so the stage falls back to a synthetic playback clock over generated
`MOCK ASSET` placeholders. Chapters, scrubbing, and the talk-track narration that arrives in
the chat rail as playback crosses each chapter are all real and driven by the actual catalog
metadata.

The live Cognigy agent runs **locally only**, behind a dev proxy. A public static site has
nowhere safe to keep a credential, so the published build has none and cannot reach Cognigy
by construction.

**Status:** working end to end. The portal talks to a live Cognigy AI Agent in OAT_Sandbox,
which selects assets from the catalog and drives the video stage. Content is not yet approved
for external use.

## Layout

| Path | What it is |
|---|---|
| [docs/solution-design.md](docs/solution-design.md) | Architecture, audience and content policy, risk profile |
| [docs/build-plan.md](docs/build-plan.md) | Phased plan, phase 0 is the current blocker list |
| [contracts/stage-directive.schema.json](contracts/stage-directive.schema.json) | Agent to frontend contract. Keep it narrow. |
| [contracts/demo-catalog.schema.json](contracts/demo-catalog.schema.json) | Catalog and tour schema |
| [catalog/demo-catalog.json](catalog/demo-catalog.json) | Real catalog. Three real videos, all `approved: false` pending review. |
| [catalog/chapters-todo.md](catalog/chapters-todo.md) | **Needs you.** Chapters and talk tracks for the three videos, plus the file-size problem. |
| [catalog/demo-catalog.seed.json](catalog/demo-catalog.seed.json) | Annotated schema example showing a well-formed record. Not for use. |
| [tools/validate-catalog.mjs](tools/validate-catalog.mjs) | Catalog validator, no dependencies. `node tools/validate-catalog.mjs` |
| [cognigy/agent-instructions.md](cognigy/agent-instructions.md) | Draft AI Agent system instruction, plus why each rail exists |
| [cognigy/tools.md](cognigy/tools.md) | The seven tool specs, agent-facing and backend responsibilities |
| [cognigy/deployed.md](cognigy/deployed.md) | **What is actually live in the tenant.** IDs, LLM gotchas, known rough edges. |
| [app/](app/README.md) | Showroom frontend. Runs in mock mode against fixtures, no backend required. |

## Three things to keep in mind while building

1. **The catalog is the product.** Retrieval quality depends on asset metadata far more than on the model. Effort spent on `summary`, `keywords` and `chapters[].talkTrack` pays back more than prompt tuning.

2. **`approved: true` is the only content gate.** All content is public, so there is no tiering and no second line of defence. Approval has to be a real review with a named reviewer and a date, never a default. With access risk gone, the primary risk becomes what the agent *says*: unapproved or invented capability claims, and quotable output on pricing, roadmap or competitors.

3. **The tool is itself a demo.** It runs on Cognigy, and its human escalation runs on CXone Digital. Build that path properly and the product demonstrates itself.

## About this repository

This is the **code** for the Digital Room, not the content.

Deliberately not included:

- **No demo media.** The videos live outside this tree and are NiCE marketing assets that have not been approved for external distribution. The dev server reads them from a local path, overridable with `SHOWROOM_MEDIA_ROOT`. Clone this and the stage will render but have nothing to play.
- **No credentials.** The Cognigy endpoint URL token is a live secret and lives only in `app/.env.local`, which is gitignored. See `app/.env.example` for the shape.
- **No tenant identifiers.** The record of the live Cognigy deployment, including project, agent, flow and LLM ids, is kept local and out of version control.

Running it after cloning gives you mock mode: fixture-driven, no backend, no model, with
generated placeholder assets watermarked MOCK ASSET. That is enough to see how the
chat-drives-the-stage architecture works.

**Licence:** none. All rights reserved. This is internal NiCE work published for
collaboration convenience, not an open-source release.

## Security posture

This repository is public. Three controls keep credentials out of it.

**1. The client never receives the token.** `COGNIGY_ENDPOINT_URL` is deliberately not
`VITE_`-prefixed, so Vite never inlines it into the bundle. The dev server proxies
`/api/cognigy` to the endpoint, server-side. Nothing in the browser, in devtools, or in a
built asset contains the token. Renaming it to `VITE_COGNIGY_ENDPOINT_URL` would publish it
to every visitor, so do not.

**2. A pre-commit hook blocks leaks before they exist.** Enable it once per clone:

```bash
git config core.hooksPath tools/git-hooks
```

It blocks env files, the local tenant-identifier record, Cognigy endpoint URLs containing
tokens, 40-plus character hex strings, and credential-shaped assignments.

This hook is the primary control, not a backstop. GitHub secret scanning recognises
vendor-shaped tokens such as AWS keys and GitHub PATs. A Cognigy endpoint URL token is a
generic 64-character hex string, so GitHub will not flag it and push protection will not stop
it. Generic-pattern scanning, which would catch it, needs GitHub Advanced Security and is not
available on this repository.

**3. GitHub secret scanning and push protection are enabled** as a second layer, for the
vendor-shaped tokens they can recognise.

### If a token is ever pushed

Treat it as burned. Deleting the commit is not enough: it stays in forks, in the GitHub
events API, and in anything that cached it. Rotate the Cognigy endpoint by regenerating its
URL token, then clean history.

### Deploying this beyond localhost

The Vite proxy is a **development** feature. It does not exist in `vite build` output, so a
statically hosted build cannot reach the agent at all. Hosting this for real needs a small
server-side proxy holding the token as an environment variable, plus rate limiting, because
an unauthenticated public endpoint that spends LLM budget will be abused. See Phase 5 in
`docs/build-plan.md`.

## Owner

Olivier Attia, Solutions Engineer, NiCE.
