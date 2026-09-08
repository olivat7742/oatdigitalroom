/**
 * Example answers for the last introduction question, chosen by department and role.
 *
 * That question asks a stranger to compose a sentence about what they want. It is the hardest
 * one in the introduction and the likeliest to produce a shrug. An example they can tap costs
 * nothing and gives retrieval something specific to work with, and they can still ignore all of
 * them and type whatever they like.
 *
 * Rules live in catalog/interest-examples.json, which the Cognigy node copies rather than
 * fetches, because it has no HTTP node in front of it. tools/test-interest-examples.mjs asserts
 * the two stay in step and that every example still retrieves something.
 */

import raw from '@catalog/interest-examples.json'
import { searchCatalog } from '@/catalog'

export interface InterestExample {
  label: string
  value: string
}

interface Group {
  key: string
  match: string[]
  examples: InterestExample[]
  /**
   * True for a group that describes almost every visitor, which makes it the WEAKER signal.
   *
   * Only 'service' is marked, and that is the point: in a contact centre showroom nearly
   * everyone answers contact centre, service or operations, so matching there discriminates
   * very little. A head of WFM whose project was for the "Contact center" got three generic
   * service examples and nothing about workforce management, because the department matched
   * first and her role was never looked at.
   */
  broad?: boolean
}

const GROUPS = raw.groups as Group[]
const FALLBACK = raw.fallback.examples as InterestExample[]

/**
 * Whole-word match, not containment.
 *
 * "it" is in the keyword list and appears inside "quality", "digital" and half the language, so
 * substring matching would route a quality manager to the IT examples. Same reason the industry
 * matcher anchors its stems.
 */
function mentions(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack)
}

function groupFor(text: string): Group | null {
  if (!text.trim()) return null
  for (const group of GROUPS) {
    if (group.match.some((keyword) => mentions(text, keyword))) return group
  }
  return null
}

/** True when the phrasing still finds an asset. The whole point of the guarantee. */
function retrieves(example: InterestExample): boolean {
  return searchCatalog(example.value, 1).length > 0
}

/**
 * The groups this visitor matches, strongest signal first.
 *
 * BOTH the department and the role are consulted, and neither wins outright. The department is
 * the scope of the project, the role is the lens the visitor will judge everything through, and
 * three buttons have room for both.
 *
 * A broad group goes last even when it was the department that matched it, because it barely
 * narrows anything. That ordering is the whole fix: a head of WFM working on a "Contact center"
 * project now leads with forecasting rather than with three generic service examples.
 */
function matchedGroups(department: string, jobTitle: string): Group[] {
  const found: Group[] = []
  for (const text of [department, jobTitle]) {
    const group = groupFor(text)
    if (group && !found.includes(group)) found.push(group)
  }
  // Stable, so two specific matches keep department-then-role order.
  return found.sort((a, b) => Number(Boolean(a.broad)) - Number(Boolean(b.broad)))
}

/**
 * Up to three examples for this visitor, or none.
 *
 * Interleaved one at a time across the matched groups, so a visitor whose department and role
 * point different ways gets both represented rather than three of one and none of the other.
 *
 * Every candidate is checked against the catalog before being offered, and an empty result is a
 * perfectly good answer: no buttons at all is better than a button that leads nowhere.
 */
export function exampleInterests(department?: string, jobTitle?: string): InterestExample[] {
  const groups = matchedGroups(department ?? '', jobTitle ?? '')
  const pools = groups.map((group) => group.examples.filter(retrieves))

  const blended: InterestExample[] = []
  for (let depth = 0; blended.length < 3; depth += 1) {
    const before = blended.length
    for (const pool of pools) {
      const example = pool[depth]
      if (example && !blended.some((e) => e.value === example.value)) blended.push(example)
      if (blended.length === 3) break
    }
    // Every pool is exhausted, so stop rather than spin.
    if (blended.length === before) break
  }

  if (blended.length > 0) return blended

  // Nothing matched, or every matched example has stopped retrieving. The second case is what
  // the runtime filter exists for: the curated list rotted and the room noticed.
  return FALLBACK.filter(retrieves).slice(0, 3)
}
