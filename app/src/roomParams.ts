/**
 * The URL parameters the Digital Room can be launched with, read once and validated hard.
 *
 *   ?t=niceworld              which look and feel to dress the room in
 *   ?c=0033n00002Yams0AAB     who the visitor is, so the room need not ask
 *
 * Both are attacker-controlled input. Everything here is deliberately paranoid about that: the
 * template is an allowlist lookup and the contact id is format-checked and never rendered.
 *
 * ------------------------------------------------------------------------------------------
 * THE CONTACT ID IS NOT A CREDENTIAL, AND MUST NOT BECOME ONE.
 *
 * Today ?c= resolves against the INVENTED fixtures in catalog/crm-fixtures.json, so it
 * discloses nothing: there is no real person behind any of those ids. That is the only reason
 * it is safe as written.
 *
 * Before this is ever pointed at real Salesforce, read the gate in docs/solution-design.md.
 * In short: a raw Salesforce id in a URL turns that URL into a lookup key for a named
 * individual's employer, role and email. It lands in browser history, referrer headers,
 * forwarded invitations, screenshots and corporate proxy logs, and it never expires.
 * Salesforce ids are also not high-entropy and the unique portion is often close to sequential
 * within an org, so treating them as unguessable is not safe. The real version takes a signed,
 * expiring token instead, verified server-side, and the id never appears in the URL at all.
 * ------------------------------------------------------------------------------------------
 */

/**
 * Salesforce record ids are 15 characters case-sensitive or 18 with a case-insensitivity
 * checksum, and the first three identify the object. 003 is Contact.
 *
 * Anything else is dropped rather than passed on: a value that is not shaped like a contact id
 * cannot be one, and refusing early means nothing downstream has to wonder.
 */
const CONTACT_ID = /^003[A-Za-z0-9]{12}([A-Za-z0-9]{3})?$/

/** Slugs are lowercase, short and boring, so a path or a script cannot be smuggled in one. */
const TEMPLATE_SLUG = /^[a-z0-9-]{1,32}$/

export interface RoomParams {
  /** A slug that PASSED the shape check. Still has to exist in the registry to be honoured. */
  template: string | null
  /** A Salesforce Contact id that passed the shape check, or null. */
  contactId: string | null
}

/**
 * Reads the parameters from a query string.
 *
 * Takes the search string rather than touching window, so it is testable and so module load
 * order never matters.
 */
export function parseRoomParams(search: string): RoomParams {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return { template: null, contactId: null }
  }

  const rawTemplate = (params.get('t') ?? '').trim().toLowerCase()
  const rawContact = (params.get('c') ?? '').trim()

  return {
    template: TEMPLATE_SLUG.test(rawTemplate) ? rawTemplate : null,
    contactId: CONTACT_ID.test(rawContact) ? rawContact : null,
  }
}

/**
 * The live parameters for this page load.
 *
 * Read once at module load. The room does not react to the URL changing afterwards, because
 * the template drives brand tokens that are read at import time and re-theming mid-session
 * would be a redesign rather than a feature.
 */
export const roomParams: RoomParams = parseRoomParams(
  typeof window === 'undefined' ? '' : window.location.search,
)
