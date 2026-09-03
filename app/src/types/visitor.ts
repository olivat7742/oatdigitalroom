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
  introductionComplete?: boolean
}

const STRING_FIELDS = [
  'firstName',
  'lastName',
  'company',
  'jobTitle',
  'email',
  'website',
  'department',
  'interest',
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

  return Object.keys(visitor).length > 0 ? visitor : null
}
