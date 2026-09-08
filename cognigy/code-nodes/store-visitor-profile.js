// OAT_DIGITAL_ROOM_store_visitor_profile
//
// MIRROR of what is deployed in Cognigy. See README.md in this directory.
//
// Stores what the agent learns during the opening introduction, and tells the portal who the
// visitor is so it can show their company logo in the header.
//
// Contact profile first, session context as a mirror. Two things were discovered by
// enumerating the actions object in this tenant rather than assumed:
//   1. The API is actions.updateProfile, NOT actions.addToContactProfile. A guessed name
//      failed a typeof check silently and everything fell back to context.
//   2. The default profile schema has firstname, lastname and email but NO company, jobTitle
//      or department. Those go to contact memory instead.
//
// accepted_gdpr, privacy_policy and prevent_data_collection also exist in the schema and are
// deliberately NOT set: the agent shows a privacy notice but never asks for affirmative
// consent, and recording consent that was never given would be a false record.

// What the introduction actually REQUIRES. A surname is deliberately not on this list.
//
// Nothing in the product needs one: the visitor is addressed by their first name, the company
// is display-only, and the identifier that matters is the email domain. Requiring it produced
// the worst kind of question, one the agent asks because a field is empty rather than because
// the answer is useful, and live it asked a visitor called "Marc Delaunay" for his last name
// immediately after he had given it. Still captured when volunteered, just never demanded.
const CORE_FIELDS = ['firstName', 'company', 'jobTitle', 'email'];
const EXTRA_FIELDS = ['department', 'interest'];
// lastName is listed here and in ARG_FIELDS but NOT in CORE_FIELDS: accepted and emitted when
// we have it, never a reason to ask a question.
const ALL_FIELDS = CORE_FIELDS.concat(EXTRA_FIELDS).concat(['lastName', 'website', 'industry', 'industrySource']);

// What the model is allowed to SUPPLY, which is not the same as what gets emitted.
//
// industrySource is deliberately absent: it records whether the vertical was looked up or
// self-reported, and it is decided here from which path produced it. Accepting it as an
// argument would let the model assert that a vertical came from an account record when the
// visitor simply typed it, and the whole reason the field exists is that those deserve
// different trust.
const ARG_FIELDS = CORE_FIELDS.concat(EXTRA_FIELDS).concat(['lastName', 'website', 'industry']);

// The twelve verticals NiCE itself filters by, in NiCE's own order.
//
// The authority is catalog/industries.json, which lookup_crm FETCHES. Only the labels are
// duplicated here, and only because this node has no HTTP fetch in front of it, exactly like
// NICE_DOMAINS and GENERIC_EMAIL_DOMAINS below. The alias and override tables are NOT copied:
// they exist to interpret messy CRM strings, which is lookup_crm's job. All this node has to
// recognise is which of the twelve buttons the visitor tapped.
const INDUSTRY_LABELS = ['Insurance','Financial','Healthcare','Retail','Telecom','Utilities','Government','Education','BPO','Technology','Travel & Hospitality','Automotive'];

// Example answers for the LAST question, the one asking what solution they are looking at.
//
// Copied from catalog/interest-examples.json, which is the authority, because this node has no
// HTTP fetch in front of it and cannot read the file. tools/test-interest-examples.mjs asserts
// the copy matches, so the duplication has an alarm on it.
//
// That test also asserts EVERY value here still returns an asset from the catalog. The portal
// filters at runtime and so can never offer a dud; this node cannot search, so the test is
// what protects it. An example button that leads nowhere is worse than no button: the visitor
// taps a suggestion the room made and the room says it has nothing.
//
// These are PHRASINGS, not asset titles. Three titles here would narrow the visitor to our
// content before we know what they came for. find_demo offers titles later.
const INTEREST_GROUPS = [
  { key: 'wfm',
    match: ['workforce', 'wfm', 'scheduling', 'schedule', 'forecast', 'planning', 'hr', 'human resources', 'shift'],
    examples: [
      { label: 'Forecasting and scheduling', value: 'AI for forecasting and scheduling' },
      { label: 'Human and AI in one team', value: 'Managing human and AI agents in one team' },
      { label: 'Engagement and shift swaps', value: 'Employee engagement and shift flexibility' }
    ] },
  { key: 'quality',
    match: ['quality', 'compliance', 'risk', 'legal', 'audit', 'qa'],
    examples: [
      { label: 'Automated quality scoring', value: 'Automated quality scoring with GenAI' },
      { label: 'Outbound calling rules', value: 'Outbound compliance and calling rules' },
      { label: 'Quality in a BPO', value: 'Quality management in a BPO' }
    ] },
  { key: 'analytics',
    match: ['analytic', 'analytics', 'insight', 'data', 'reporting', 'bi', 'intelligence'],
    examples: [
      { label: 'Analytics to action', value: 'Turning analytics into automated actions' },
      { label: 'Real time insight', value: 'Real time insights from every interaction' },
      { label: 'AI guided analytics', value: 'AI guided analytics' }
    ] },
  { key: 'it',
    match: ['it', 'information technology', 'architect', 'architecture', 'engineer', 'engineering', 'platform', 'developer', 'technical', 'cto', 'cio'],
    examples: [
      { label: 'Building an AI agent', value: 'How do I actually build an AI agent?' },
      { label: 'AI without replacing my ACD', value: 'Adding AI without replacing my ACD' },
      { label: 'Unified data', value: 'Unified data and smarter actions' }
    ] },
  { key: 'growth',
    match: ['sales', 'marketing', 'growth', 'outbound', 'collections', 'revenue', 'campaign'],
    examples: [
      { label: 'How outbound works', value: 'How does outbound engagement work?' },
      { label: 'Campaign compliance', value: 'Proactive outreach and campaign compliance' },
      { label: 'Outbound as growth', value: 'Outbound as a growth channel' }
    ] },
  { key: 'exec',
    match: ['chief', 'vp', 'vice president', 'executive', 'transformation', 'strategy', 'board'],
    examples: [
      { label: 'What analysts say', value: 'What do analysts say about NiCE for CCaaS?' },
      { label: 'Scaling AI', value: 'Scaling AI across the business' },
      { label: 'CX trends for 2026', value: 'CX technology trends for 2026' }
    ] },
  { key: 'service',
    match: ['service', 'support', 'care', 'contact center', 'contact centre', 'call center', 'call centre', 'customer experience', 'cx', 'operations', 'ops'],
    examples: [
      { label: 'Helping agents live', value: 'How do you help agents during a conversation?' },
      { label: 'Self service that works', value: 'Self service that contains the call' },
      { label: 'AI as the front door', value: 'Agentic AI as the front door to customer service' }
    ] }
];

// Used when neither the department nor the role matches, which is common: "Innovation",
// "Digital", a blank answer. The three pillars of the room, so there is always somewhere to go.
const INTEREST_FALLBACK = [
  { label: 'Helping agents live', value: 'How do you help agents during a conversation?' },
  { label: 'The supervisor view', value: 'What does the supervisor experience look like?' },
  { label: 'How outbound works', value: 'How does outbound engagement work?' }
];

// Answers used to steer the introduction but NOT part of the visitor contract. Kept separate
// because contracts/visitor-payload.schema.json sets additionalProperties false, so emitting
// these raw would produce a payload that fails its own contract.
const WORKING_FIELDS = ['niceIntent', 'onBehalfOfCompany', 'onBehalfOfWebsite'];

// Personal providers identify no employer, so a visitor on one of these is asked for their
// company website instead. Twin of GENERIC_EMAIL_DOMAINS in app/src/company.ts: the portal
// needs it client-side to resolve the logo, this node needs it to know whether to ask. Keep
// the two in step.
const GENERIC_EMAIL_DOMAINS = ['gmail.com','googlemail.com','outlook.com','outlook.fr','hotmail.com','hotmail.fr','hotmail.co.uk','live.com','live.fr','msn.com','yahoo.com','yahoo.fr','yahoo.co.uk','icloud.com','me.com','mac.com','aol.com','protonmail.com','proton.me','gmx.com','gmx.de','gmx.net','web.de','mail.com','mail.ru','yandex.ru','qq.com','163.com','free.fr','orange.fr','wanadoo.fr','laposte.net','sfr.fr','bbox.fr','numericable.fr','zoho.com','fastmail.com','hey.com','tutanota.com','example.com','example.org','example.net'];

// Domains whose holder is a colleague rather than a visiting customer. Twin of niceDomains in
// catalog/crm-fixtures.json, which app/src/crm.ts and lookup_crm both read. Same arrangement,
// and same obligation, as GENERIC_EMAIL_DOMAINS above: keep them in step. Hardcoded here only
// because this node has no HTTP fetch in front of it.
const NICE_DOMAINS = ['nice.com', 'niceincontact.com', 'nice-incontact.com', 'incontact.com', 'cognigy.com'];

function clean(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function emailDomain(email) {
  const value = clean(email).toLowerCase();
  const at = value.lastIndexOf('@');
  if (at === -1) { return ''; }
  return value.slice(at + 1).replace(/^www\./, '');
}

const args = (input.aiAgent && input.aiAgent.toolArgs) || {};

let existing = {};
try {
  if (context && context.digitalRoomVisitor && typeof context.digitalRoomVisitor === 'object') {
    existing = Object.assign({}, context.digitalRoomVisitor);
  }
} catch (e) { existing = {}; }

const merged = Object.assign({}, existing);
ARG_FIELDS.concat(WORKING_FIELDS).forEach(function (field) {
  const value = clean(args[field]);
  if (value !== '') { merged[field] = value; }
});

// A visitor who answers "Marc Delaunay" usually arrives here as firstName="Marc Delaunay" with
// no lastName, and the agent then thanks "Marc Delaunay" by their full name in every reply.
// Split on the FIRST space, so the given name is the first token: "Maria del Carmen Rodriguez"
// keeps Maria as the name to address her by, which is the part that gets used. Done here
// rather than left to the model because it is not a judgement, and twin of the same split in
// app/src/transport/MockTransport.ts.
// Runs whenever firstName holds more than one word, NOT only when lastName is missing. Live,
// the model passed firstName "Camille DUBOIS" together with lastName "DUBOIS", so a guard on
// the empty lastName skipped and every reply addressed her as "Camille DUBOIS".
if (/\s/.test(clean(merged.firstName))) {
  const whole = clean(merged.firstName);
  const cut = whole.indexOf(' ');
  const rest = whole.slice(cut + 1).trim();
  merged.firstName = whole.slice(0, cut);
  if (clean(merged.lastName) === '' && rest !== '') { merged.lastName = rest; }
}

// THE CLAIMED IDENTITY, from the launch URL via the portal.
//
// The room can be opened with ?c=<Salesforce Contact id>, and CognigyTransport sends the
// resolved contact as data._launch on every turn until the introduction finishes. It is sent
// repeatedly on purpose: the model does not reliably call this tool on the opening turn, and
// Cognigy only carries client data for the turn it arrived on.
//
// Several locations are tried because which one the channel populates is not something to
// guess at. launchSource in the result reports which one answered.
function readLaunch() {
  const candidates = [
    input.data,
    input.request && input.request.data,
    input.payload && input.payload.data
  ];
  const names = ['input.data', 'input.request.data', 'input.payload.data'];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c && typeof c === 'object' && c._launch && typeof c._launch === 'object') {
      return { source: names[i], value: c._launch };
    }
  }
  return null;
}

const launchRead = readLaunch();

// Copied into the merged bag so it survives to later turns, under a launch prefix so it can
// never be mistaken for something the visitor actually told us. NOT emitted: the payload is
// built from an ALL_FIELDS allowlist, so nothing here can leak into it.
if (launchRead) {
  const L = launchRead.value;
  const map = {
    launchContactId: L.contactId,
    launchFirstName: L.firstName,
    launchLastName: L.lastName,
    launchJobTitle: L.jobTitle,
    launchEmail: L.email,
    launchCompany: L.company
  };
  Object.keys(map).forEach(function (key) {
    if (clean(map[key]) !== '' && clean(merged[key]) === '') { merged[key] = clean(map[key]); }
  });
}

const hasLaunch = clean(merged.launchFirstName) !== '';

// Accepting or rejecting the claimed identity.
//
// Anything that is not clearly a rejection counts as acceptance, because the buttons say
// "Yes, that's me" and "Not me" and the two mistakes do not cost the same. A wrongly discarded
// identity costs three questions. A wrongly accepted one files the session against a stranger
// and addresses them by someone else's name all the way to the closing page.
// An answer only counts if the question was actually PUT to the visitor on an earlier turn.
//
// This gate is not paranoia about the model, it is a bug it already committed. On the very
// first tool call, with the launch identity present and the confirmation not yet asked, it
// passed identityConfirmed itself and the node accepted an identity nobody in the room had
// agreed to. A forwarded invitation would have been silently accepted, which is the single
// thing this whole confirmation exists to prevent.
//
// identityAsked is persisted only on a turn where the question was genuinely returned, so the
// model cannot manufacture consent by answering on the visitor's behalf. Same shape as
// industryAsked.
// PRE-CONFIRMED BY THE PORTAL, which is the path this product actually uses.
//
// CognigyTransport puts the identity question itself, before sending the agent anything, and
// only sets confirmed once the visitor has accepted. A refusal sends no _launch at all, so
// there is nothing here to accept. Trusted because a deterministic step produced it, unlike
// the model answering on the visitor's behalf, which is what the gate below is for.
const launchPreConfirmed = Boolean(launchRead && launchRead.value && launchRead.value.confirmed === true);

// An answer from the MODEL only counts if the question was actually PUT on an earlier turn.
// That gate is not paranoia, it is a bug it already committed: on the very first tool call,
// with the confirmation not yet asked, it passed identityConfirmed itself and the node
// accepted an identity nobody in the room had agreed to. A forwarded invitation would have
// been silently accepted, which is the single thing this confirmation exists to prevent.
// identityAsked is persisted only on a turn where the question was genuinely returned.
const identityWasAsked = existing.identityAsked === 'true';
const identityAnswer = launchPreConfirmed ? "Yes, that's me" : clean(args.identityConfirmed);
if (identityAnswer !== '' && hasLaunch && (launchPreConfirmed || identityWasAsked) && merged.identityAccepted !== 'true' && merged.identityRejected !== 'true') {
  if (/\b(not me|no|nope|wrong|isn'?t me|is not me|someone else|different)\b/i.test(identityAnswer)) {
    // People forward invitations. A rejection discards everything and the ordinary questions
    // come back, because the fields below stay empty.
    merged.identityRejected = 'true';
  } else {
    merged.identityAccepted = 'true';
    if (clean(merged.firstName) === '') { merged.firstName = merged.launchFirstName; }
    if (clean(merged.lastName) === '' && clean(merged.launchLastName) !== '') { merged.lastName = merged.launchLastName; }
    if (clean(merged.jobTitle) === '' && clean(merged.launchJobTitle) !== '') { merged.jobTitle = merged.launchJobTitle; }
    if (clean(merged.email) === '' && clean(merged.launchEmail) !== '') { merged.email = merged.launchEmail; }
    // The account NAME, not a domain. Display only, exactly like a typed company answer.
    if (clean(merged.company) === '' && clean(merged.launchCompany) !== '') { merged.company = merged.launchCompany; }
  }
}

// True while the room has a claimed identity that the person in it has not yet settled.
const identityPending = hasLaunch && merged.identityAccepted !== 'true' && merged.identityRejected !== 'true';

const domain = emailDomain(merged.email);
const emailIsPersonal = domain !== '' && GENERIC_EMAIL_DOMAINS.indexOf(domain) !== -1;

// Anchored at the END, so eu.nice.com counts as internal but nice.com.attacker.io does not.
function isNiceDomain(d) {
  if (!d) { return false; }
  for (let i = 0; i < NICE_DOMAINS.length; i++) {
    if (d === NICE_DOMAINS[i] || d.slice(-(NICE_DOMAINS[i].length + 1)) === '.' + NICE_DOMAINS[i]) { return true; }
  }
  return false;
}
const isNiceEmployee = isNiceDomain(domain);

// Anything that is not clearly "for myself" is treated as being for a customer. Erring this
// way costs one extra question when wrong; erring the other way silently skips the CRM lookup
// the colleague actually wanted.
const intentAnswer = clean(merged.niceIntent).toLowerCase();
const intentGiven = intentAnswer !== '';
const forOwnKnowledge = intentGiven && /\b(own|myself|self|my knowledge|personal|learn|learning|curious|curiosity|general|no one|nobody|none)\b/.test(intentAnswer);
const forCustomer = intentGiven && !forOwnKnowledge;

// Everyone except a colleague exploring for their own knowledge. They are neither a customer
// nor a lead, nothing is looked up for them, and no vertical changes what is worth showing
// them, so they are the one visitor who is never asked.
const audienceIsProspect = !(isNiceEmployee && forOwnKnowledge);

// THE VERTICAL: taken from CRM when CRM can answer, asked when it cannot.
//
// context.crm is written by the lookup_crm post-process. When the account record carried a
// mappable industry it holds the canonical label already, so the question is skipped: asking
// something we know the answer to is the fastest way to look like a form rather than a guide.
let crmIndustry = '';
let crmResolved = false;
try {
  if (context && context.crm && typeof context.crm === 'object') {
    // Whether the lookup has RUN, which is not the same as whether it found a vertical. A new
    // lead resolves with no industry at all, and conflating the two made the question wait for
    // a lookup that had already happened and had nothing to say.
    crmResolved = true;
    if (context.crm.industry) { crmIndustry = clean(context.crm.industry); }
  }
} catch (e) { crmIndustry = ''; crmResolved = false; }

if (crmIndustry !== '' && clean(merged.industry) === '') {
  merged.industry = crmIndustry;
  merged.industrySource = 'crm';
}

// Matched against the twelve rather than stored verbatim, because everything downstream keys
// on the label. Exact match first, then containment so a typed "we're in retail banking"
// still lands somewhere sensible.
//
// No match is a NORMAL outcome, not an error: the question invites the visitor to say none of
// them fit, and a logistics or manufacturing company genuinely has no NiCE vertical. Recording
// nothing is the honest result, and better than forcing them into the nearest-looking box.
function matchIndustry(value) {
  const answer = clean(value).toLowerCase();
  if (answer === '') { return null; }
  for (let i = 0; i < INDUSTRY_LABELS.length; i++) {
    if (answer === INDUSTRY_LABELS[i].toLowerCase()) { return INDUSTRY_LABELS[i]; }
  }
  for (let i = 0; i < INDUSTRY_LABELS.length; i++) {
    if (answer.indexOf(INDUSTRY_LABELS[i].toLowerCase()) !== -1) { return INDUSTRY_LABELS[i]; }
  }
  return null;
}

// Only re-derived for an ASKED answer. A label already carried over from CRM above is
// canonical by construction and must not be second-guessed here.
const industryAnswered = clean(args.industry) !== '';
if (industryAnswered && merged.industrySource !== 'crm') {
  const picked = matchIndustry(args.industry);
  if (picked) {
    merged.industry = picked;
    merged.industrySource = 'asked';
  } else {
    delete merged.industry;
    delete merged.industrySource;
  }
  // Records that the question has now been PUT, separately from whether it produced an answer.
  //
  // Without this a decline loops forever: nothing is recorded, so nothing is known, so the
  // question is added to the plan again, and a visitor in an industry we do not list can never
  // finish the introduction. Not a contract field and never emitted; it lives in the merged bag
  // only so it survives to the next turn through context.digitalRoomVisitor.
  merged.industryAsked = true;
}

const industryKnown = clean(merged.industry) !== '';
const industryDeclined = merged.industryAsked === true && !industryKnown;

// Four questions covering six fields, plus a fifth only when the email identifies no employer.
const QUESTION_PLAN = [];

// FIRST when the launch URL claimed an identity, so it replaces the name, employer and email
// questions rather than being asked alongside them. Confirming is one tap instead of three
// answers. On rejection those three come back on their own, because their fields stay empty.
if (identityPending) {
  QUESTION_PLAN.push({
    needs: ['identityConfirmed'],
    ask: 'Do NOT ask their name, employer or email: the invitation already told you. Instead greet them by first name and say you have them down as being at that company, then ask if that is right. Show the FIRST NAME and the COMPANY and nothing else: never read their own email address or job title back at them. Two buttons appear automatically, so do not list the options.'
  });
}

QUESTION_PLAN.push(
  { needs: ['firstName'], ask: 'Ask for their name. Whatever they give is enough: do NOT follow up asking for a surname.' },
  { needs: ['company', 'jobTitle'], ask: 'Ask where they work and what their role is there. One question, both answers.' },
  { needs: ['email'], ask: 'Ask for their business email, and say plainly it is so you can follow up or send them anything they want to keep.' }
);

if (emailIsPersonal) {
  QUESTION_PLAN.push({
    needs: ['website'],
    ask: 'Their email is a personal address, so it does not tell you which company they are with. Ask for their company website, and say briefly that it helps you tailor things to their organisation.'
  });
}

// A colleague is not a lead. Running them through the customer script would put NiCE's own
// logo in the header and would either match NiCE's own account or mark a colleague as a new
// lead, so ask who the session is really for. Placed after the email question because that is
// the moment the domain identifies them.
if (isNiceEmployee) {
  QUESTION_PLAN.push({
    needs: ['niceIntent'],
    ask: 'They are a NiCE colleague, so ask a different question: is this for their own knowledge, or are they preparing for a specific customer or prospect?'
  });

  if (forCustomer) {
    QUESTION_PLAN.push({
      needs: ['onBehalfOfCompany', 'onBehalfOfWebsite'],
      ask: 'Ask which customer or prospect it is for, and that company website. Say briefly that the website is the useful part because company names repeat across countries. One question, both answers.'
    });
  }
}

QUESTION_PLAN.push({ needs: ['department'], ask: 'Ask which department or team the project is for. It may not be their own.' });
QUESTION_PLAN.push({ needs: ['interest'], ask: 'Ask what kind of solution they are looking at, in their own words. Three example answers appear as BUTTONS automatically, so do NOT list, name or hint at any of them, but do add that they can tap one or describe it themselves.' });

// The vertical, asked ONLY when nothing has answered it: no CRM match, or an unmappable CRM
// industry.
//
// LAST, not at the point the company becomes known, even though that is where the decision is
// really made. lookup_crm is a separate tool call the model has to choose to make, and putting
// this question at the end gives that call two questions' worth of room to land, so the common
// case is that CRM has already answered and this is never reached. app/src/fixtures/
// conversation.ts places it last for the same reason, so the two stay in step.
//
// A colleague exploring for themselves is excluded outright: nothing is searched for them, and
// they have no vertical that changes what is worth showing.
const askIndustry = !industryKnown && !industryDeclined && audienceIsProspect;
if (askIndustry) {
  QUESTION_PLAN.push({
    needs: ['industry'],
    ask: 'Ask which industry they are in. Say plainly that it is the single biggest factor in which customer stories you show them, and that if none of the options fit they should just say so and you will leave it out. The twelve options appear as BUTTONS automatically, so do NOT list, name or hint at any of them.'
  });
}

let profileWritten = false;

try {
  const standard = {};
  if (merged.firstName) { standard.firstname = merged.firstName; }
  if (merged.lastName) { standard.lastname = merged.lastName; }
  if (merged.email) { standard.email = merged.email; }
  if (Object.keys(standard).length > 0 && actions && typeof actions.updateProfile === 'function') {
    actions.updateProfile(standard);
    profileWritten = true;
  }
} catch (e) { /* fall through to context */ }

try {
  if (actions && typeof actions.addContactMemory === 'function') {
    const memories = {
      company: merged.company,
      jobTitle: merged.jobTitle,
      department: merged.department,
      industry: merged.industry,
      solutionInterest: merged.interest,
      website: merged.website,
      preparingFor: merged.onBehalfOfCompany,
      companyDomain: merged.website ? clean(merged.website) : (emailIsPersonal ? '' : domain)
    };
    Object.keys(memories).forEach(function (key) {
      if (memories[key]) {
        try { actions.addContactMemory(key, memories[key]); profileWritten = true; } catch (e) { /* skip */ }
      }
    });
  }
} catch (e) { /* fall through to context */ }

try {
  if (actions && typeof actions.setContext === 'function') {
    actions.setContext('digitalRoomVisitor', merged);
  } else if (context) {
    context.digitalRoomVisitor = merged;
  }
} catch (e) {
  try { context.digitalRoomVisitor = merged; } catch (e2) { /* nothing else to try */ }
}

const missingCore = CORE_FIELDS.filter(function (f) { return clean(merged[f]) === ''; });
const missingExtra = EXTRA_FIELDS.filter(function (f) { return clean(merged[f]) === ''; });

let nextStep = null;
for (let i = 0; i < QUESTION_PLAN.length; i++) {
  const step = QUESTION_PLAN[i];
  const outstanding = step.needs.filter(function (f) { return clean(merged[f]) === ''; });
  if (outstanding.length > 0) { nextStep = { ask: step.ask, fields: outstanding }; break; }
}

const complete = nextStep === null;

// Who is actually in the room. Derived from the email domain, never asked directly.
let audience = 'customer';
if (isNiceEmployee) { audience = forCustomer ? 'nice-on-behalf' : 'nice-internal'; }

// The company the CRM lookup and the header logo should follow. For a colleague preparing for
// a customer that is the CUSTOMER, not NiCE, which is the whole point of asking.
const lookupWebsite = audience === 'nice-on-behalf'
  ? clean(merged.onBehalfOfWebsite)
  : (clean(merged.website) || (emailIsPersonal ? '' : domain));

// Tell the portal who this is, so it can put the company logo in the header. A sibling of
// _showroom, not part of it: this says nothing about what is on the stage.
// Contract: contracts/visitor-payload.schema.json
const visitorPayload = { v: 1, introductionComplete: complete, audience: audience };
ALL_FIELDS.forEach(function (field) {
  if (clean(merged[field]) !== '') { visitorPayload[field] = merged[field]; }
});

// Nested, not flat. The working answers are not contract fields, and the schema rejects extras.
if (audience === 'nice-on-behalf') {
  const onBehalfOf = {};
  if (clean(merged.onBehalfOfCompany) !== '') { onBehalfOf.company = clean(merged.onBehalfOfCompany); }
  if (clean(merged.onBehalfOfWebsite) !== '') { onBehalfOf.website = clean(merged.onBehalfOfWebsite); }
  if (Object.keys(onBehalfOf).length > 0) { visitorPayload.onBehalfOf = onBehalfOf; }
}

try {
  actions.output(null, { _visitor: visitorPayload });
} catch (e) { /* the portal simply will not personalise; not worth failing the turn */ }

// The vertical question's twelve options, as BUTTONS.
//
// Emitted only on the turn that actually asks it. All twelve are offered rather than a
// shortlist: a shortlist would be us guessing which vertical the visitor is in, which is the
// exact mistake the whole normalisation exists to avoid. There is no "none of these" button
// because the composer is always there and the question says so, and a thirteenth would push
// the list past the contract's limit.
//
// action 'offer' touches the stage not at all. Every other action has a side effect, so
// offering a choice would otherwise disturb whatever the visitor is looking at.
// Contract: contracts/stage-directive.schema.json
// Whether the CRM lookup still has to happen before this question means anything. Computed
// here rather than beside the guidance below, because it decides both.
const crmLookupPending = !complete && audienceIsProspect && !crmResolved && Boolean(lookupWebsite);

// Whole-word match, not containment. 'it' is a keyword and appears inside 'quality', 'digital'
// and half the language, so substring matching would send a quality manager to the IT examples.
function mentionsWord(haystack, keyword) {
  const escaped = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + escaped + '\\b', 'i').test(String(haystack || ''));
}

function groupFor(text) {
  if (clean(text) === '') { return null; }
  for (let g = 0; g < INTEREST_GROUPS.length; g++) {
    const group = INTEREST_GROUPS[g];
    for (let k = 0; k < group.match.length; k++) {
      if (mentionsWord(text, group.match[k])) { return group; }
    }
  }
  return null;
}

// BOTH the department and the role are consulted, and neither wins outright. The department is
// the scope of the project, the role is the lens the visitor judges everything through, and
// three buttons have room for both.
//
// A broad group goes LAST even when the department matched it, because it barely narrows
// anything. That ordering is the fix for a real visitor: a head of WFM whose project was for
// the "Contact center" got three generic service examples and nothing about workforce
// management, because the department matched first and her role was never looked at.
function interestExamples(department, jobTitle) {
  const found = [];
  const texts = [clean(department), clean(jobTitle)];
  for (let t = 0; t < texts.length; t++) {
    const group = groupFor(texts[t]);
    if (group && found.indexOf(group) === -1) { found.push(group); }
  }
  // Stable, so two specific matches keep department-then-role order.
  found.sort(function (a, b) { return (a.broad ? 1 : 0) - (b.broad ? 1 : 0); });

  if (found.length === 0) { return INTEREST_FALLBACK; }

  // Interleaved one at a time, so a department and role pointing different ways both get
  // represented rather than three of one and none of the other.
  const blended = [];
  for (let depth = 0; blended.length < 3; depth++) {
    const before = blended.length;
    for (let i = 0; i < found.length && blended.length < 3; i++) {
      const example = found[i].examples[depth];
      if (!example) { continue; }
      let seen = false;
      for (let b = 0; b < blended.length; b++) {
        if (blended[b].value === example.value) { seen = true; }
      }
      if (!seen) { blended.push(example); }
    }
    if (blended.length === before) { break; }
  }

  return blended.length > 0 ? blended : INTEREST_FALLBACK;
}

const askingIndustryNow =
  nextStep !== null && nextStep.fields.indexOf('industry') !== -1 && !crmLookupPending;

// Examples for the interest question, as BUTTONS.
//
// Composing a sentence about what you want is the hardest question in the introduction and the
// likeliest to produce a shrug, so the room offers three tappable starting points chosen from
// the department and role. They are examples, not a menu: the visitor can ignore all three and
// type anything, and the question says so.
//
// Same one-set-of-buttons-per-turn rule as the vertical question. This is the last question
// before the introduction completes, so nothing else emits a cta in the same turn.
// The identity confirmation's two buttons.
const askingIdentityNow = nextStep !== null && nextStep.fields.indexOf('identityConfirmed') !== -1;

// Recorded ONLY on a turn where the question was genuinely returned, which is what makes the
// identityWasAsked gate above meaningful. A second setContext rather than reordering the whole
// node: the first one runs before nextStep is known.
if (askingIdentityNow) {
  try {
    actions.setContext('digitalRoomVisitor', Object.assign({}, merged, { identityAsked: 'true' }));
  } catch (e) { /* the confirmation will simply be asked again next turn */ }
}

if (askingIdentityNow) {
  try {
    actions.output(null, {
      _showroom: {
        v: 1,
        action: 'offer',
        cta: [
          { label: "Yes, that's me", value: "Yes, that's me", kind: 'quick_reply' },
          { label: 'Not me', value: 'Not me', kind: 'quick_reply' }
        ]
      }
    });
  } catch (e) { /* they can still type it; not worth failing the turn */ }
}

const askingInterestNow = nextStep !== null && nextStep.fields.indexOf('interest') !== -1;
if (askingInterestNow) {
  try {
    actions.output(null, {
      _showroom: {
        v: 1,
        action: 'offer',
        cta: interestExamples(merged.department, merged.jobTitle).map(function (e) {
          return { label: e.label, value: e.value, kind: 'quick_reply' };
        })
      }
    });
  } catch (e) { /* they can still type it; not worth failing the turn */ }
}

if (askingIndustryNow) {
  try {
    actions.output(null, {
      _showroom: {
        v: 1,
        action: 'offer',
        cta: INDUSTRY_LABELS.map(function (label) {
          return { label: label, value: label, kind: 'quick_reply' };
        })
      }
    });
  } catch (e) { /* the visitor can still type it; not worth failing the turn */ }
}

// The choices are BUTTONS, so the reply must not repeat them.
//
// This guidance used to say "offer exactly three example questions", and the agent duly wrote
// them out as a bulleted list. find_demo now also emits them as quick-reply buttons under the
// chat, so the visitor was reading a paragraph and then finding the identical three choices
// underneath it, which is more to read and slower to act on, not less.
//
// Two instructions pulling in opposite directions is worse than either alone, so this one
// changed rather than adding a louder note somewhere else.
// Phrased as an EXAMPLE rather than only a prohibition. Told merely not to list the options,
// the agent stopped bulleting them and paraphrased all three in a flowing sentence instead,
// which is the same duplication in prose. A model answer is followed more reliably than a rule.
const CHOICES_ARE_BUTTONS =
  ' The choices appear to the visitor as BUTTONS automatically. Your whole reply is ONE short line that does NOT describe them, exactly like: "Thanks, Camille. Here is where I would start. Tap whichever fits, or ask me anything else." Never list, number, bullet, summarise or hint at what the options are, and never ask which one they want: the buttons do that.';

let completionGuidance = 'The introduction is done. Thank them in one line using their first name, then call OAT_DIGITAL_ROOM_lookup_crm ONCE, then call OAT_DIGITAL_ROOM_find_demo using their stated interest and department. Do not show anything on the stage yet: let them choose.' + CHOICES_ARE_BUTTONS;
if (audience === 'nice-on-behalf') {
  completionGuidance = 'The introduction is done. This is a NiCE colleague preparing for a customer, so conduct the rest as if that customer were the visitor. Call OAT_DIGITAL_ROOM_lookup_crm ONCE passing companyWebsite as the CUSTOMER website in crmLookupWebsite, not nice.com. Then call OAT_DIGITAL_ROOM_find_demo using their stated interest and department. Do not show anything on the stage yet.' + CHOICES_ARE_BUTTONS;
} else if (audience === 'nice-internal') {
  completionGuidance = 'The introduction is done. This is a NiCE colleague exploring for their own knowledge, so they are neither a customer nor a lead: do NOT call OAT_DIGITAL_ROOM_lookup_crm. Thank them in one line, then call OAT_DIGITAL_ROOM_find_demo using their stated interest and department. Do not show anything on the stage yet.' + CHOICES_ARE_BUTTONS;
}

// Nudges the lookup EARLY, as soon as there is something to look up, instead of waiting for
// the introduction to finish. Two reasons, and the second is the important one:
//
//   1. The vertical question at the end of the plan is skipped when CRM has answered, so the
//      lookup has to have happened by then or the visitor is asked something we know.
//   2. The model does not reliably call this tool at all. Asking earlier gives it more
//      chances, and when it still never fires the question is simply asked, which is the safe
//      direction to fail: a redundant question costs one tap, a missing lookup costs the
//      vertical entirely.
// The vertical question is the one that must not be asked before the lookup, so when it is
// next up this spells the sequence out rather than hoping for the right order.
//
// A visitor who supplies their whole introduction in one message has everything decided in a
// single tool call, and at that moment nothing has been looked up. Live, the agent duly asked
// helioretail.com its industry when the account record already said Retail Trade, which is
// exactly the form-like behaviour this feature exists to avoid.
//
// The question text is still returned either way, so a model that ignores the instruction asks
// it anyway. A redundant question costs one tap; saying nothing at all is far worse.
const industryIsNext = nextStep !== null && nextStep.fields.indexOf('industry') !== -1;
let lookupNudge = '';
if (crmLookupPending) {
  lookupNudge = industryIsNext
    ? ' Do NOT ask this question yet. First call OAT_DIGITAL_ROOM_lookup_crm ONCE with companyWebsite set to crmLookupWebsite, then call OAT_DIGITAL_ROOM_save_visitor_profile again with NO new arguments. That second call tells you whether this question is still needed. Ask it only if it comes back again. Say nothing to the visitor about the lookup itself.'
    : ' Before you ask it, call OAT_DIGITAL_ROOM_lookup_crm ONCE with crmLookupWebsite as companyWebsite, unless you already called it this conversation. Say nothing about that lookup to the visitor.';
}

// A question's buttons must be the LAST buttons of the turn, or they answer a question the
// visitor is not being asked. Applies to the interest question too, which also has buttons.
//
// Observed live: a visitor asked for a demo mid-introduction, so this node emitted the twelve
// industry options and then find_demo emitted three asset titles, which replaced them. The
// visitor was asked "which industry are you in?" and offered three videos to tap. The client
// cannot fix this, because it has no way to know which pending question a set of buttons
// belongs to, so the turn simply must not do both.
//
// Deferring the content is the right way round: the question is one tap and the demo is still
// there afterwards, whereas a demo shown now with the wrong buttons under it wastes both.
if (askingIndustryNow || askingInterestNow || askingIdentityNow) {
  lookupNudge += ' This question is the WHOLE turn. Do NOT call OAT_DIGITAL_ROOM_find_demo or OAT_DIGITAL_ROOM_show_demo in this turn, even if the visitor just asked to see something: its suggestions would replace this question\'s buttons and leave the visitor answering the wrong question. If they asked for content, say in one clause that you will bring it up next, then ask this.';
}

input.result = {
  ok: true,
  storedIn: profileWritten ? 'profile+context' : 'context',
  known: merged,
  audience: audience,
  industry: clean(merged.industry) || null,
  industrySource: clean(merged.industrySource) || null,
  askingIndustry: askingIndustryNow,
  askingInterest: askingInterestNow,
  askingIdentity: askingIdentityNow,
  // Diagnostics for the launch URL. launchSource reports WHICH input location carried the
  // claimed identity, because which one the channel populates is not worth guessing at: if
  // this is null while the portal is sending one, the payload is arriving somewhere else.
  launchSource: launchRead ? launchRead.source : null,
  identityState: hasLaunch
    ? (merged.identityAccepted === 'true' ? 'accepted' : merged.identityRejected === 'true' ? 'rejected' : 'pending')
    : 'none',
  crmLookupWebsite: lookupWebsite || null,
  companyDomain: merged.website ? clean(merged.website) : (emailIsPersonal ? null : (domain || null)),
  emailIsPersonalProvider: emailIsPersonal,
  missingCore: missingCore,
  missingOptional: missingExtra,
  introductionComplete: complete,
  nextQuestion: nextStep ? nextStep.ask : null,
  guidance: complete
    ? completionGuidance
    : 'Ask ONLY the next question, in your own words, as one short question. Do not stack questions and do not re-ask anything already present in known.' + lookupNudge
};
