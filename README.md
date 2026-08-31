# Digital Room

An agentic, self-service interactive showcase for NiCE CXone and Cognigy.

A visitor asks sales, how-to or technical questions. An AI guide answers in a grounded way
and pushes matching content onto a stage: video with chapters, clickable walkthroughs,
architecture diagrams. A dynamic guided demo rather than a static demo library.

Audiences: prospects, existing customers, NiCE sales reps, NiCE partners. All four see the
same content, which is public and approved for external use. Audience changes framing and
depth only.

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

## Owner

Olivier Attia, Solutions Engineer, NiCE.
