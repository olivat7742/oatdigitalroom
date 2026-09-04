# Cognigy Code node sources

The JavaScript deployed inside the `OAT_DIGITAL_ROOM_*` Code nodes, kept here because
**the MCP connector cannot read a Code node's source.**

That is not a minor inconvenience. It blocked work twice in one session:

- `find_demo` could not be given the portal's improved retrieval scoring, because a rewrite could not be reverted and its I/O contract could not be known.
- `wrap_up` could not be taught about the CRM lookup, for the same reason, until the source was pasted in by hand.

`get_resource {resourceType: 'flow'}` returns metadata. So does the same call with `raw: true`.
So does `list_resources {resourceType: 'tool'}`. None of them return `config.code`. A Code node
edited only in the Cognigy UI therefore exists in exactly one place, with no diff, no history
and no way back.

## Keeping these honest

These files are a MIRROR, not the running code. Cognigy is the source of truth at runtime, so a
change made in the UI and not copied here silently makes this directory a lie, which is worse
than not having it. When you change a Code node:

1. Change it in Cognigy, or via `manage_flow_nodes { operation: "update" }`.
2. Paste the same source here in the same commit.

The reverse is also worth knowing: everything here can be pushed back with
`manage_flow_nodes { operation: "update", flowId, nodeId, config: { code } }`, which is the
recovery path if a node is damaged.

## Node map

| File | Node |
|---|---|
| `build-summary.js` | `OAT_DIGITAL_ROOM_build_summary` |
| `search-catalog.js` | `OAT_DIGITAL_ROOM_search_catalog` |
| `store-visitor-profile.js` | `OAT_DIGITAL_ROOM_store_visitor_profile` |
| `lookup-crm-postprocess.js` | post-process of `OAT_DIGITAL_ROOM_lookup_crm` |

Both live in `OAT_DIGITAL_ROOM_Guide Flow`. The flow and node **ids are deliberately not
here**: they are tenant identifiers, and this repository is public. They are in
`../deployed.md`, which is gitignored for exactly that reason, and
`manage_flow_nodes { operation: "list", flowId }` reprints them at any time.

Not yet mirrored, because their source still cannot be read: `emit_stage_directive` and
`record_handoff`. Paste each one in as it becomes available.

## Which of these must agree with the portal

Two pairs are supposed to behave identically, and both have already drifted once:

| Cognigy | Portal |
|---|---|
| `search-catalog.js` scoring | `searchCatalog` in `app/src/catalog.ts` |
| `lookup-crm-postprocess.js` | `lookupCrm` in `app/src/crm.ts` |

`node tools/test-retrieval.mjs` and `node tools/test-crm.mjs` assert the PORTAL side only.
Nothing automatically checks the Cognigy side, so a change there has to be exercised with
`talk_to_agent`. Every ranking bug in this project so far was found that way and not by the
test suite.

## No credentials here

These are logic only. The endpoint URL token, tenant identifiers and LLM connection details
are not in Code nodes and must not be added to them. Both nodes here fetch public files from
this repository over plain HTTPS with no authentication.
