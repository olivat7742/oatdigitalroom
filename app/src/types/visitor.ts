/**
 * Mirrors contracts/visitor-payload.schema.json.
 *
 * A sibling of the stage directive, not part of it. The Stage has no business knowing who the
 * visitor is, and the visitor payload says nothing about what is on the stage.
 */

export const VISITOR_PAYLOAD_VERSION = 1

export interface Visitor {
  firstName?: string
  lastName?: string
  /** Display only. Never used to guess a domain: see app/src/company.ts for why. */
  company?: string
  jobTitle?: string
  email?: string
  website?: string
  department?: string
  interest?: string
  /**
   * Who is actually in the room. Derived from the email domain, never asked directly.
   * Absent for an ordinary visitor, so a client that ignores it behaves as before.
   */
  audience?: 'customer' | 'nice-internal' | 'nice-on-behalf'
  /** Present only for 'nice-on-behalf': the company the NiCE employee is preparing for. */
  onBehalfOf?: { company?: string; website?: string }
  /** One of the twelve labels in catalog/industries.json. Never a raw CRM string. */
  industry?: string
  /** Whether the vertical was looked up or self-reported. See the contract for why. */
  industrySource?: 'crm' | 'asked'
  introductionComplete?: boolean
}

const AUDIENCES = ['customer', 'nice-internal', 'nice-on-behalf'] as const
const INDUSTRY_SOURCES = ['crm', 'asked'] as const

const STRING_FIELDS = [
  'firstName',
  'lastName',
  'company',
  'jobTitle',
  'email',
  'website',
  'department',
  'interest',
  'industry',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Pulls a visitor payload out of a message `data`, or returns null.
 *
 * Same strictness as extractDirective: an unrecognised version is ignored rather than guessed
 * at, and only known fields are copied through.
 */
export function extractVisitor(data: unknown): Visitor | null {
  if (!isRecord(data)) return null

  const payload = data['_visitor']
  if (!isRecord(payload)) return null

  if (payload['v'] !== VISITOR_PAYLOAD_VERSION) {
    console.warn(
      `[showroom] ignoring visitor payload with unsupported version ${String(payload['v'])}; this client supports v${VISITOR_PAYLOAD_VERSION}`,
    )
    return null
  }

  const visitor: Visitor = {}
  for (const field of STRING_FIELDS) {
    const value = payload[field]
    if (typeof value === 'string' && value.trim() !== '') visitor[field] = value.trim()
  }
  if (typeof payload['introductionComplete'] === 'boolean') {
    visitor.introductionComplete = payload['introductionComplete']
  }

  // Validated against the enum rather than copied through. An unknown audience would silently
  // fall into the "ordinary visitor" branch everywhere it is read, which is the wrong default
  // for a value whose whole job is to say this visitor is NOT ordinary.
  const audience = payload['audience']
  if (typeof audience === 'string' && (AUDIENCES as readonly string[]).includes(audience)) {
    visitor.audience = audience as Visitor['audience']
  }

  // Validated against the enum, like audience: an unknown source would otherwise be treated
  // as trustworthy by anything that only checks whether the field is present.
  const industrySource = payload['industrySource']
  if (
    typeof industrySource === 'string' &&
    (INDUSTRY_SOURCES as readonly string[]).includes(industrySource)
  ) {
    visitor.industrySource = industrySource as Visitor['industrySource']
  }

  const onBehalfOf = payload['onBehalfOf']
  if (isRecord(onBehalfOf)) {
    const nested: { company?: string; website?: string } = {}
    for (const field of ['company', 'website'] as const) {
      const value = onBehalfOf[field]
      if (typeof value === 'string' && value.trim() !== '') nested[field] = value.trim()
    }
    if (Object.keys(nested).length > 0) visitor.onBehalfOf = nested
  }

  return Object.keys(visitor).length > 0 ? visitor : null
}
