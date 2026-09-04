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

const CORE_FIELDS = ['firstName', 'lastName', 'company', 'jobTitle', 'email'];
const EXTRA_FIELDS = ['department', 'interest'];
const ALL_FIELDS = CORE_FIELDS.concat(EXTRA_FIELDS).concat(['website', 'industry', 'industrySource']);

// What the model is allowed to SUPPLY, which is not the same as what gets emitted.
//
// industrySource is deliberately absent: it records whether the vertical was looked up or
// self-reported, and it is decided here from which path produced it. Accepting it as an
// argument would let the model assert that a vertical came from an account record when the
// visitor simply typed it, and the whole reason the field exists is that those deserve
// different trust.
const ARG_FIELDS = CORE_FIELDS.concat(EXTRA_FIELDS).concat(['website', 'industry']);

// The twelve verticals NiCE itself filters by, in NiCE's own order.
//
// The authority is catalog/industries.json, which lookup_crm FETCHES. Only the labels are
// duplicated here, and only because this node has no HTTP fetch in front of it, exactly like
// NICE_DOMAINS and GENERIC_EMAIL_DOMAINS below. The alias and override tables are NOT copied:
// they exist to interpret messy CRM strings, which is lookup_crm's job. All this node has to
// recognise is which of the twelve buttons the visitor tapped.
const INDUSTRY_LABELS = ['Insurance','Financial','Healthcare','Retail','Telecom','Utilities','Government','Education','BPO','Technology','Travel & Hospitality','Automotive'];

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

// Five questions covering seven fields, plus a sixth only when the email identifies no
// employer. Name, and company plus role, are each asked once.
const QUESTION_PLAN = [
  { needs: ['firstName', 'lastName'], ask: 'Ask for their name.' },
  { needs: ['company', 'jobTitle'], ask: 'Ask where they work and what their role is there. One question, both answers.' },
  { needs: ['email'], ask: 'Ask for their business email, and say plainly it is so you can follow up or send them anything they want to keep.' }
];

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
QUESTION_PLAN.push({ needs: ['interest'], ask: 'Ask what kind of solution they are looking at, in their own words.' });

// The vertical, asked ONLY when nothing has answered it: no CRM match, an unmappable CRM
// industry, or a colleague browsing for their own knowledge, for whom nothing is looked up.
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

const askingIndustryNow =
  nextStep !== null && nextStep.fields.indexOf('industry') !== -1 && !crmLookupPending;
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

input.result = {
  ok: true,
  storedIn: profileWritten ? 'profile+context' : 'context',
  known: merged,
  audience: audience,
  industry: clean(merged.industry) || null,
  industrySource: clean(merged.industrySource) || null,
  askingIndustry: askingIndustryNow,
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
