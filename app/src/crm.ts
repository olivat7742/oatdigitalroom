/**
 * CRM lookup for the Digital Room.
 *
 * Once the visitor and their company are known, we want to say whether NiCE already has a
 * relationship with that company, and if so who owns it, so the closing summary can name a
 * real person instead of offering a generic form.
 *
 * ---------------------------------------------------------------------------------------
 * THE DATA HERE IS INVENTED. IT MUST STAY INVENTED.
 *
 * The live Salesforce org this would eventually query is NiCE's production CRM: real customer
 * names, real employee names, at scale. None of that belongs in a public GitHub repository, so
 * every company and every representative below is fictional.
 * If you wire this to the real org, the lookup moves server-side and this file keeps its
 * fixtures for mock mode. Do not paste real query results in here.
 * ---------------------------------------------------------------------------------------
 *
 * BEFORE THIS IS POINTED AT REAL CRM DATA, read the gate in docs/solution-design.md. In
 * short: the Digital Room is unauthenticated and the visitor's identity is self-declared, so
 * a lookup keyed on a typed-in domain lets anyone with the URL ask "is Acme a NiCE customer,
 * and who is their account executive?" and get a truthful answer. That is a customer-list and
 * staff-directory disclosure, and it is enumerable. Mock mode leaks nothing because none of
 * this is real, which is exactly why real data is not here yet.
 */

import { resolveCompanyDomain } from '@/company'
import { normaliseIndustry, type Industry } from '@/industries'
import fixtures from '@catalog/crm-fixtures.json'

/**
 * Which Salesforce object the match came from. Ordered by how much it tells us: an open
 * opportunity means an active sales conversation, an account means an existing relationship,
 * a contact or lead means someone is known but no relationship is established.
 */
export type CrmMatchType = 'opportunity' | 'account' | 'contact' | 'lead'

export interface CrmSalesRep {
  name: string
  role?: string
}

export interface CrmLookupResult {
  /**
   * known      a record exists, so there is someone who owns the relationship
   * new-lead   nothing found, so this visitor would become a new lead
   * skipped    deliberately not searched, currently a NiCE employee browsing for themselves
   */
  status: 'known' | 'new-lead' | 'skipped'
  matchType?: CrmMatchType
  accountName?: string
  /** Present only when status is "known". A new lead has nobody assigned yet, by definition. */
  salesRep?: CrmSalesRep
  /** The domain the lookup was keyed on, so the decision is auditable rather than magic. */
  domain?: string
  /**
   * The account's vertical, normalised to one of the twelve.
   *
   * Absent whenever CRM cannot answer usefully, which is common: the field holds over a
   * thousand distinct values, a large share of accounts say only "Other", and industries with
   * no NiCE vertical are deliberately left unmapped. Absent means ask the visitor, never guess.
   */
  industry?: Industry
}

/**
 * Domains whose holder is a NiCE employee rather than a visiting customer.
 *
 * cognigy.com is included because Cognigy is part of NiCE, so those colleagues are internal
 * for this purpose even though the domain differs.
 */
const NICE_DOMAINS = new Set(fixtures.niceDomains)

export function isNiceEmployee(email: string | undefined): boolean {
  if (!email) return false
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  const domain = email.slice(at + 1).trim().toLowerCase()
  if (!domain) return false
  // Covers subdomains such as eu.nice.com without matching a lookalike like nice.com.attacker.io,
  // because the check is on the END of the string.
  for (const known of NICE_DOMAINS) {
    if (domain === known || domain.endsWith(`.${known}`)) return true
  }
  return false
}

/**
 * The fictional CRM, read from catalog/crm-fixtures.json.
 *
 * That file rather than a literal here, because the Cognigy lookup_crm tool fetches the same
 * file from the public repo. Two copies would drift, and the failure mode is specific and
 * embarrassing: the portal telling a visitor they are a known account while the live agent
 * tells the same visitor they are a new lead.
 *
 * Keyed by domain, because a domain is the one identifier that is stable and unambiguous:
 * company names repeat across countries, and "Orange" is a telecom in France and a county in
 * California.
 *
 * The four entries cover the four match types deliberately, so a demo can show each path
 * rather than only the happy one.
 */
const FIXTURES = fixtures.accounts as Record<string, Omit<CrmLookupResult, 'status' | 'domain'>>

/**
 * Looks up a company and reports whether NiCE already knows it.
 *
 * Keyed on the domain, never on the typed company name. The same reasoning as the header logo
 * in company.ts: a name is ambiguous and a wrong match here would tell a visitor they are an
 * existing customer of a company they have never dealt with, or name the wrong employee.
 *
 * Returns "new-lead" rather than an error when nothing matches. Not finding a record IS the
 * answer to the question being asked, and it is the common case.
 */
export function lookupCrm(input: { email?: string; website?: string }): CrmLookupResult {
  // resolveCompanyDomain already returns null for a personal provider such as gmail, with
  // reason "generic-provider". That rule lives there and is not duplicated here: it decides
  // which logo goes in the header, and the two must never disagree about who the visitor
  // works for.
  const { domain } = resolveCompanyDomain(input)

  // No usable domain means we cannot identify the company at all, from a personal address
  // with no website or from an unparseable one. Treated as a new lead, which is the honest
  // outcome: there is nothing to match on, so nothing was found.
  if (!domain) return { status: 'new-lead' }

  const hit = FIXTURES[domain]
  if (!hit) return { status: 'new-lead', domain }

  // rawIndustry is the CRM value verbatim, normalised here rather than stored pre-cleaned, so
  // that swapping the fixture for a live Salesforce read changes nothing downstream.
  const { rawIndustry, ...account } = hit as typeof hit & { rawIndustry?: string }
  const industry = normaliseIndustry(rawIndustry)

  return { status: 'known', domain, ...account, ...(industry ? { industry } : {}) }
}

/**
 * The one line the closing summary shows about the relationship.
 *
 * Kept here rather than in the panel so the wording is decided once and the renderer stays a
 * renderer. A new lead is told an Account Executive will be assigned, which is true and
 * useful, rather than being shown an empty space where a name would be.
 */
export function crmSummaryLine(crm: CrmLookupResult | undefined): string | null {
  if (!crm || crm.status === 'skipped') return null

  if (crm.status === 'known' && crm.salesRep) {
    const role = crm.salesRep.role ? `${crm.salesRep.role}, ` : ''
    const account = crm.accountName ? ` for ${crm.accountName}` : ''
    return `Your NiCE contact${account} is ${crm.salesRep.name} (${role}already working with your organisation).`
  }

  return 'You are new to us, so an Account Executive will be assigned to your account shortly and will pick up from here.'
}
