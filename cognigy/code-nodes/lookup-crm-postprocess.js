// Post-process of OAT_DIGITAL_ROOM_lookup_crm
//
// MIRROR of what is deployed in Cognigy. See README.md in this directory.
//
// The tool is an `http` tool whose HTTP node GETs
//   https://raw.githubusercontent.com/olivat7742/oatdigitalroom/main/catalog/crm-fixtures.json
// and whose Resolve answer is {{JSON.stringify(input.crmResult)}}.
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
} else {
  result = { status: 'new-lead', domain: subject };
}

result.fixtureData = true;
result.catalogSize = Object.keys(accounts).length;

// Persisted so wrap_up can build the closing page from what was actually looked up, rather
// than from the model's recollection of this tool result.
actions.setContext('crm', result);

input.crmResult = result;
delete input.httprequest;
