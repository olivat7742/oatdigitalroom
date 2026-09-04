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
 * The live Salesforce org this would eventually query is NiCE's production CRM: roughly
 * 250,000 accounts, real customer names, real employee names. None of that belongs in a
 * public GitHub repository, so every company and every representative below is fictional.
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
}

/**
 * Domains whose holder is a NiCE employee rather than a visiting customer.
 *
 * cognigy.com is included because Cognigy is part of NiCE, so those colleagues are internal
 * for this purpose even though the domain differs.
 */
const NICE_DOMAINS = new Set([
  'nice.com',
  'niceincontact.com',
  'nice-incontact.com',
  'incontact.com',
  'cognigy.com',
])

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
 * The fictional CRM. Keyed by domain, because a domain is the one identifier that is stable
 * and unambiguous: company names repeat across countries, and "Orange" is a telecom in France
 * and a county in California.
 *
 * These four cover the four match types deliberately, so a demo can show each path rather than
 * only the happy one.
 */
const FIXTURES: Record<string, Omit<CrmLookupResult, 'status' | 'domain'>> = {
  'northwindlogistics.com': {
    matchType: 'opportunity',
    accountName: 'Northwind Logistics',
    salesRep: { name: 'Camille Fournier', role: 'Account Executive' },
  },
  'vantagebank.com': {
    matchType: 'account',
    accountName: 'Vantage Bank',
    salesRep: { name: 'Daniel Okafor', role: 'Client Director' },
  },
  'helioretail.com': {
    matchType: 'contact',
    accountName: 'Helio Retail Group',
    salesRep: { name: 'Sofia Lindqvist', role: 'Account Executive' },
  },
  'brightpathcare.com': {
    matchType: 'lead',
    accountName: 'Brightpath Care',
    salesRep: { name: 'Marc Delaunay', role: 'Sales Development' },
  },
}

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

  return { status: 'known', domain, ...hit }
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
