/**
 * Working out which company a visitor belongs to, and finding its logo.
 *
 * The company NAME is not usable for this. "Banque Lyonnaise", "Orange", "Apex Logistics" are
 * all ambiguous internationally, and guessing a domain from a name would eventually put a
 * stranger's logo in the header of a NiCE sales tool. The email DOMAIN is authoritative and we
 * already collect it, so no extra question is needed in the common case.
 *
 * The exception is a personal email provider, which identifies nothing. For those the agent
 * asks for the company website instead.
 */

/**
 * Personal and generic providers. An address at one of these tells us nothing about the
 * visitor's employer, and without this list a visitor on Gmail would get Gmail's logo
 * presented as their company's, which is worse than showing nothing.
 */
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.fr',
  'hotmail.com',
  'hotmail.fr',
  'hotmail.co.uk',
  'live.com',
  'live.fr',
  'msn.com',
  'yahoo.com',
  'yahoo.fr',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'web.de',
  'mail.com',
  'mail.ru',
  'yandex.ru',
  'qq.com',
  '163.com',
  'free.fr',
  'orange.fr',
  'wanadoo.fr',
  'laposte.net',
  'sfr.fr',
  'bbox.fr',
  'numericable.fr',
  'zoho.com',
  'fastmail.com',
  'hey.com',
  'tutanota.com',
  // Reserved test domains. Real in demos, never real companies.
  'example.com',
  'example.org',
  'example.net',
])

function normaliseHost(host: string): string | null {
  const cleaned = host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    ?.split(':')[0]

  if (!cleaned) return null
  // Must look like a domain: at least one dot, no spaces, plausible TLD.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(cleaned)) return null
  if (!/\.[a-z]{2,}$/.test(cleaned)) return null
  return cleaned
}

export interface CompanyIdentity {
  domain: string | null
  /** Why there is no domain, so the UI and the agent can react sensibly. */
  reason?: 'no-input' | 'generic-provider' | 'unparseable'
}

/**
 * Resolves a company domain, preferring an explicitly given website over the email domain.
 *
 * A website is only asked for when the email is a personal provider, so when it is present it
 * is the more deliberate signal.
 */
export function resolveCompanyDomain(input: { email?: string; website?: string }): CompanyIdentity {
  if (input.website) {
    const fromSite = normaliseHost(input.website)
    if (fromSite) return { domain: fromSite }
  }

  const email = (input.email ?? '').trim().toLowerCase()
  if (!email) {
    return { domain: null, reason: input.website ? 'unparseable' : 'no-input' }
  }

  const at = email.lastIndexOf('@')
  if (at === -1) return { domain: null, reason: 'unparseable' }

  const host = normaliseHost(email.slice(at + 1))
  if (!host) return { domain: null, reason: 'unparseable' }
  if (GENERIC_EMAIL_DOMAINS.has(host)) return { domain: null, reason: 'generic-provider' }

  return { domain: host }
}

/**
 * Logo candidates, in order, for use as an `<img>` fallback chain.
 *
 * Both services return a genuine 404 for a domain they do not know, verified rather than
 * assumed, so an `onError` handler reliably detects failure. That matters: a service that
 * answered 200 with a generic globe would put a placeholder in the header looking like a real
 * company logo.
 *
 * DuckDuckGo first: it returned noticeably higher-resolution icons in testing, and it is the
 * more privacy-consistent choice for a page that already uses youtube-nocookie. Note that
 * either service does learn which company domain is being looked up.
 *
 * Clearbit's logo API is deliberately absent. It is dead since the HubSpot acquisition and
 * now fails outright.
 */
export function logoCandidates(domain: string): string[] {
  const safe = encodeURIComponent(domain)
  return [
    `https://icons.duckduckgo.com/ip3/${safe}.ico`,
    `https://www.google.com/s2/favicons?domain=${safe}&sz=128`,
  ]
}
