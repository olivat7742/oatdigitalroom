// Post-process of OAT_DIGITAL_ROOM_lookup_crm
//
// MIRROR of what is deployed in Cognigy. See README.md in this directory.
//
// The tool is an `http` tool with TWO HTTP nodes in front of this one, and a Resolve answer of
// {{JSON.stringify(input.crmResult)}}:
//
//   1. .../main/catalog/crm-fixtures.json  stored at the default input.httprequest
//   2. .../main/catalog/industries.json    stored at input.industryRules (inputStore)
//
// The second one has an explicit inputStore precisely so it does not overwrite the first.
//
// Mirrors app/src/crm.ts. Both read catalog/crm-fixtures.json so they cannot disagree
// about the same company.
//
// INVENTED DATA. See the gate in docs/solution-design.md before this touches real CRM: the
// Digital Room is unauthenticated and the identity is self-declared, so a live lookup would
// tell anyone with the URL whether a company is a NiCE customer and who owns the account.
var fx = (input.httprequest && input.httprequest.result) || {};
var accounts = fx.accounts || {};
var niceDomains = fx.niceDomains || [];
var args = (input.aiAgent && input.aiAgent.toolArgs) || {};

// The industry vocabulary, fetched by the SECOND HTTP node in this tool from
// catalog/industries.json. Fetched rather than embedded for the same reason as the fixtures:
// app/src/industries.ts and tools/build-catalog.mjs read the same file, and three copies of a
// mapping table would drift silently until a visitor was shown the wrong vertical's stories.
//
// The wrapper shape depends on how the node stores its result, so both are accepted. An empty
// object is a safe fallback: no rules means no industry, which is a normal outcome anyway.
var rulesRaw = input.industryRules || {};
var vocabulary = rulesRaw.industries ? rulesRaw : (rulesRaw.result || {});
var INDUSTRY_RULES = vocabulary.industries || [];
var INDUSTRY_OVERRIDES = vocabulary.exactOverrides || {};
var INDUSTRY_JUNK = (vocabulary.junk && vocabulary.junk.values) || [];

// Twin of clean() in app/src/industries.ts. The zero-width strip is not paranoia: the live org
// holds "Other", "Healthcare" and "Technology" with an invisible character appended, alongside
// their clean twins, and they are different strings to a computer.
function cleanIndustry(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[​-‍﻿­]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Maps a raw CRM industry onto one of the twelve, or returns null.
//
// Null is a real answer, not a failure: Salesforce Industry holds well over a thousand distinct
// values in practice, a large share of them saying only "Other", and industries with no NiCE
// vertical are deliberately left unmapped. Null makes the room ASK the visitor. A wrong
// vertical puts the wrong customer story in front of someone, which is worse than none.
function normaliseIndustry(value) {
  var key = cleanIndustry(value);
  if (!key) { return null; }
  if (INDUSTRY_JUNK.indexOf(key) !== -1) { return null; }

  // Overrides win, for values whose keywords point two ways at once. "Finance and Insurance"
  // is the important one: a census bucket holding both, which alias order alone would send to
  // Insurance, taking every bank in it along.
  if (Object.prototype.hasOwnProperty.call(INDUSTRY_OVERRIDES, key)) {
    var slug = INDUSTRY_OVERRIDES[key];
    if (!slug) { return null; }
    for (var o = 0; o < INDUSTRY_RULES.length; o++) {
      if (INDUSTRY_RULES[o].slug === slug) {
        return { slug: INDUSTRY_RULES[o].slug, label: INDUSTRY_RULES[o].label };
      }
    }
    return null;
  }

  for (var r = 0; r < INDUSTRY_RULES.length; r++) {
    var aliases = INDUSTRY_RULES[r].aliases || [];
    for (var a = 0; a < aliases.length; a++) {
      if (key.indexOf(aliases[a]) !== -1) {
        return { slug: INDUSTRY_RULES[r].slug, label: INDUSTRY_RULES[r].label };
      }
    }
  }
  return null;
}

var email = String(args.email || '').trim().toLowerCase();
var site = String(args.companyWebsite || '').trim().toLowerCase();

// Same normalisation as normaliseHost in app/src/company.ts: strip scheme, www, path and
// port, then require something that actually looks like a domain. A bare company name must
// NOT become a domain, or the wrong account executive gets named.
function host(value) {
  if (!value) return null;
  var cleaned = value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  if (!cleaned) return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(cleaned)) return null;
  if (!/\.[a-z]{2,}$/.test(cleaned)) return null;
  return cleaned;
}

function isNice(addr) {
  if (!addr) return false;
  var at = addr.lastIndexOf('@');
  if (at === -1) return false;
  var d = addr.slice(at + 1).trim();
  if (!d) return false;
  for (var i = 0; i < niceDomains.length; i++) {
    // Anchored at the END, so eu.nice.com matches but nice.com.attacker.io does not.
    if (d === niceDomains[i] || d.slice(-(niceDomains[i].length + 1)) === '.' + niceDomains[i]) return true;
  }
  return false;
}

var emailDomain = null;
if (email.indexOf('@') !== -1) emailDomain = host(email.slice(email.lastIndexOf('@') + 1));

var subject = host(site) || (isNice(email) ? null : emailDomain);

var result;
if (isNice(email) && !host(site)) {
  // A colleague exploring for themselves is neither a customer nor a lead. Searching would
  // find NiCE's own account or mark them as a new lead, and the closing page would then tell
  // them an Account Executive will be assigned to them, which is nonsense.
  result = { status: 'skipped', reason: 'NiCE employee with no customer named' };
} else if (!subject) {
  // Nothing usable to match on, from a personal address or an unparseable site. Reported as a
  // new lead because that is the honest outcome: nothing was found.
  result = { status: 'new-lead' };
} else if (accounts[subject]) {
  var hit = accounts[subject];
  result = {
    status: 'known',
    domain: subject,
    matchType: hit.matchType,
    accountName: hit.accountName,
    salesRepName: hit.salesRep && hit.salesRep.name,
    salesRepRole: hit.salesRep && hit.salesRep.role
  };
  // Normalised here rather than stored pre-cleaned in the fixture, so swapping the fixture for
  // a live Salesforce read changes nothing downstream. Omitted entirely when it maps to
  // nothing, which is what tells save_visitor_profile to ask the visitor instead.
  var vertical = normaliseIndustry(hit.rawIndustry);
  if (vertical) {
    result.industry = vertical.label;
    result.industrySlug = vertical.slug;
    result.industrySource = 'crm';
  }
} else {
  result = { status: 'new-lead', domain: subject };
}

result.fixtureData = true;
result.catalogSize = Object.keys(accounts).length;
// Reported so a failed vocabulary fetch is visible as itself, rather than looking like every
// account suddenly having no vertical.
result.industryRulesLoaded = INDUSTRY_RULES.length;

// Persisted so wrap_up can build the closing page from what was actually looked up, rather
// than from the model's recollection of this tool result.
actions.setContext('crm', result);

input.crmResult = result;
delete input.httprequest;
// Dropped so the whole industry vocabulary does not travel back to the model as part of the
// turn. It is a lookup table, not an answer.
delete input.industryRules;
