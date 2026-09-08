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
 * Up to three examples for this visitor, or none.
 *
 * The department decides, falling back to the role, because the question is which department the
 * project is for: that is a better signal about what they need than their seniority. A VP of
 * Sales asking for the service team should get service examples.
 *
 * Every candidate is checked against the catalog before being offered, and an empty result is a
 * perfectly good answer: no buttons at all is better than a button that leads nowhere.
 */
export function exampleInterests(department?: string, jobTitle?: string): InterestExample[] {
  const group = groupFor(department ?? '') ?? groupFor(jobTitle ?? '')
  const preferred = (group?.examples ?? []).filter(retrieves)
  if (preferred.length > 0) return preferred.slice(0, 3)

  // The group's examples have all stopped matching, so fall back rather than show nothing. This
  // is the case the runtime filter exists for: the curated list rotted and the room noticed.
  return FALLBACK.filter(retrieves).slice(0, 3)
}
