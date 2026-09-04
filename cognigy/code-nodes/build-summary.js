// OAT_DIGITAL_ROOM_build_summary
//
// MIRROR of what is deployed in Cognigy. See README.md in this directory: Cognigy is the
// source of truth at runtime, so change both together or this file becomes a lie.
//
// Runs inside the wrap_up tool branch, after two HTTP nodes:
//   OAT_DIGITAL_ROOM_fetch_catalog_for_summary       -> input.catalogFetch
//   OAT_DIGITAL_ROOM_fetch_crm_fixtures_for_summary  -> input.crmFixtures
//
// Builds the closing summary and puts it on the stage.
//
// Built from context.digitalRoomViewed, which show_demo appends to every time it actually
// plays something. That is the point: the recap reflects what the visitor really saw, not what
// the model remembers showing them. Asking the model to recall its own session would produce a
// confident and occasionally wrong list, which is the failure this project keeps designing out.
//
// Contract: contracts/stage-directive.schema.json, action=wrapup

function unwrap(raw) {
  let value = raw;
  if (value && typeof value === 'object' && value.result !== undefined) { value = value.result; }
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (e) { return null; }
  }
  return value && typeof value === 'object' ? value : null;
}

const payload = unwrap(input.catalogFetch);
const catalogAssets = payload && Array.isArray(payload.assets) ? payload.assets : [];

function assetById(id) {
  for (let i = 0; i < catalogAssets.length; i++) {
    if (catalogAssets[i].id === id) { return catalogAssets[i]; }
  }
  return null;
}

let viewedIds = [];
try {
  if (context && Array.isArray(context.digitalRoomViewed)) { viewedIds = context.digitalRoomViewed.slice(); }
} catch (e) { viewedIds = []; }

let visitor = {};
try {
  if (context && context.digitalRoomVisitor && typeof context.digitalRoomVisitor === 'object') {
    visitor = context.digitalRoomVisitor;
  }
} catch (e) { visitor = {}; }

const viewed = [];
const topics = [];
const seenTopics = {};

for (let i = 0; i < viewedIds.length; i++) {
  const asset = assetById(viewedIds[i]);
  if (!asset) { continue; }

  const entry = { assetId: asset.id, title: asset.title };
  if (typeof asset.durationSeconds === 'number') { entry.durationSeconds = asset.durationSeconds; }
  // Only genuinely public addresses. A dev media path would be a dead link once bookmarked.
  if (asset.source && asset.source.watchUrl) { entry.watchUrl = asset.source.watchUrl; }
  if (Array.isArray(asset.references) && asset.references.length > 0) { entry.references = asset.references.slice(0, 4); }
  viewed.push(entry);

  const useCases = Array.isArray(asset.useCases) ? asset.useCases : [];
  for (let u = 0; u < useCases.length; u++) {
    const id = String(useCases[u]).toLowerCase();
    if (!seenTopics[id] && topics.length < 8) {
      seenTopics[id] = true;
      // Pre-ticked: they demonstrably engaged with this.
      topics.push({ id: id, label: useCases[u], preselected: true });
    }
  }
}

// Adjacent suggestions from their stated interest, unticked, so the list is not limited to
// what they already saw.
const interest = String(visitor.interest || '').toLowerCase();
if (interest && topics.length < 8) {
  const terms = interest.split(/[^a-z0-9]+/).filter(function (t) { return t.length > 3; });
  for (let a = 0; a < catalogAssets.length && topics.length < 8; a++) {
    const asset = catalogAssets[a];
    const hay = [asset.title, (asset.keywords || []).join(' '), (asset.useCases || []).join(' ')].join(' ').toLowerCase();
    let hit = false;
    for (let t = 0; t < terms.length; t++) { if (hay.indexOf(terms[t]) !== -1) { hit = true; break; } }
    if (!hit) { continue; }
    const useCases = Array.isArray(asset.useCases) ? asset.useCases : [];
    for (let u = 0; u < useCases.length && topics.length < 8; u++) {
      const id = String(useCases[u]).toLowerCase();
      if (!seenTopics[id]) { seenTopics[id] = true; topics.push({ id: id, label: useCases[u] }); }
    }
  }
}

const firstName = String(visitor.firstName || '').split(' ')[0];

const summary = {
  headline: firstName ? ('Thanks, ' + firstName + '.') : 'Thanks for visiting.',
  viewed: viewed,
  topics: topics,
  emailKnown: !!visitor.email
};

// ---------------------------------------------------------------------------------------
// Whether NiCE already knows this company.
//
// context.crm is written by lookup_crm when the agent calls it. It does not always call it:
// a visitor who gives their details, asks for a demo and says goodbye in ONE message finishes
// the introduction and wraps up in a single turn, and the tool never fires. That produced a
// closing page with no relationship line at all for a new lead, which is the exact case the
// line exists for.
//
// So the lookup is repeated here from the same fixture file, deterministically, whenever
// context.crm is missing. The model decides nothing; it only decides whether to name a
// customer, which is something it actually knows from the conversation.
//
// INVENTED DATA. See the disclosure gate in docs/solution-design.md before this reads real CRM.
// ---------------------------------------------------------------------------------------
function crmHost(value) {
  if (!value) { return null; }
  const cleaned = String(value).trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  if (!cleaned) { return null; }
  // A bare company name must NEVER become a domain, or the wrong account executive is named.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(cleaned)) { return null; }
  if (!/\.[a-z]{2,}$/.test(cleaned)) { return null; }
  return cleaned;
}

function computeCrm() {
  const fx = unwrap(input.crmFixtures);
  if (!fx) { return null; }
  const accounts = fx.accounts || {};
  const niceDomains = fx.niceDomains || [];

  // A colleague preparing for a customer is looked up against THAT customer, not their own
  // employer, which is the entire point of asking which company it is for.
  const onBehalf = crmHost(visitor.onBehalfOfWebsite || '');

  const email = String(visitor.email || '').trim().toLowerCase();
  if (!onBehalf && email.indexOf('@') === -1) { return null; }
  const domain = onBehalf || crmHost(email.slice(email.lastIndexOf('@') + 1));
  if (!domain) { return { status: 'new-lead' }; }

  // Skipped entirely when a customer website was given: the colleague is not the subject.
  for (let i = 0; !onBehalf && i < niceDomains.length; i++) {
    // Anchored at the END, so eu.nice.com matches but nice.com.attacker.io does not.
    if (domain === niceDomains[i] || domain.slice(-(niceDomains[i].length + 1)) === '.' + niceDomains[i]) {
      // A colleague with no customer named is neither a customer nor a lead.
      return null;
    }
  }

  const hit = accounts[domain];
  if (!hit) { return { status: 'new-lead' }; }
  return {
    status: 'known',
    salesRepName: hit.salesRep && hit.salesRep.name,
    salesRepRole: hit.salesRep && hit.salesRep.role,
    accountName: hit.accountName,
    matchType: hit.matchType
  };
}

try {
  let crm = (context && context.crm) || null;
  let crmSource = 'lookup_crm';
  if (!crm) { crm = computeCrm(); crmSource = 'recomputed in build_summary'; }

  if (crm && (crm.status === 'known' || crm.status === 'new-lead')) {
    // Mapped field by field, not spread. context.crm also carries domain, catalogSize and
    // fixtureData, which are lookup diagnostics; the summary contract sets additionalProperties
    // false and none of them belong on a page shown to a visitor.
    const block = { status: crm.status };
    if (crm.status === 'known') {
      // Only meaningful for a known account: a new lead has nobody assigned yet, which is the
      // entire point of the distinction.
      if (crm.salesRepName) { block.salesRepName = crm.salesRepName; }
      if (crm.salesRepRole) { block.salesRepRole = crm.salesRepRole; }
      if (crm.accountName) { block.accountName = crm.accountName; }
      if (crm.matchType) { block.matchType = crm.matchType; }
    }
    summary.crm = block;
    input.crmSource = crmSource;
  }
} catch (e) { /* A failed lookup must never stop the summary rendering. */ }

actions.output(null, { _showroom: { v: 1, action: 'wrapup', summary: summary } });

input.result = {
  ok: true,
  viewedCount: viewed.length,
  topicCount: topics.length,
  emailKnown: !!visitor.email,
  crmStatus: (summary.crm && summary.crm.status) || 'none',
  guidance: 'The summary is now on the stage. Say ONE short line telling them it is there, that they can tick topics and choose how to follow up, and that the chat stays open if they think of anything else. Do NOT say goodbye and do NOT list the topics: they can see them.'
};
