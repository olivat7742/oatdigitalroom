/**
 * The one industry vocabulary, and the rules for mapping a messy CRM value onto it.
 *
 * Rules live in catalog/industries.json rather than here, because the Cognigy lookup_crm tool
 * fetches the same file. Two copies would drift, and the failure mode is a visitor being shown
 * the wrong vertical's customer stories.
 *
 * WHY THIS EXISTS AT ALL
 * Salesforce Industry is not a picklist in practice: across a large account base the field
 * holds well over a thousand distinct values. "Financial Services", "Finance and Insurance",
 * "Banks", "Banking", "Finance" and "Banks & Credit Cards" are all one vertical. Some values
 * also carry an invisible zero-width character, so "Healthcare" and "Healthcare​" are
 * different strings to a computer and identical to a person. Raw matching would silently miss
 * a large share of accounts.
 */

import raw from '@catalog/industries.json'

export interface Industry {
  slug: string
  label: string
}

interface IndustryRule extends Industry {
  aliases: string[]
}

const RULES = raw.industries as IndustryRule[]

/** Display order is the file's order, which follows NiCE's own listing. */
export const INDUSTRIES: Industry[] = RULES.map(({ slug, label }) => ({ slug, label }))

const OVERRIDES = raw.exactOverrides as Record<string, string | null>
const JUNK = new Set(raw.junk.values)

/**
 * Strips the characters that make two identical-looking values different.
 *
 * The zero-width set is not paranoia: "Other", "Healthcare" and "Technology" all exist in the
 * org with an invisible character appended, alongside their clean twins, on a meaningful
 * number of accounts each.
 */
function clean(value: string): string {
  return value
    .replace(/[​-‍﻿­]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Maps a raw CRM industry string to one of the twelve, or null.
 *
 * Null is a real answer, not a failure: it means the room should ask the visitor rather than
 * guess. Deliberately partial, so Manufacturing and Professional Services return null instead
 * of being forced into the nearest-looking box. A wrong vertical puts the wrong customer story
 * in front of someone, which is worse than no vertical at all.
 */
export function normaliseIndustry(value: string | undefined | null): Industry | null {
  if (!value) return null
  const key = clean(value)
  if (!key || JUNK.has(key)) return null

  // Overrides win. They exist for values whose keywords point two ways at once: "Finance and
  // Insurance" is a census bucket holding both, and alias order alone would send every bank
  // in it to Insurance.
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, key)) {
    const slug = OVERRIDES[key]
    return slug ? (INDUSTRIES.find((i) => i.slug === slug) ?? null) : null
  }

  for (const rule of RULES) {
    if (rule.aliases.some((alias) => key.includes(alias))) {
      return { slug: rule.slug, label: rule.label }
    }
  }
  return null
}

export function industryBySlug(slug: string | undefined | null): Industry | null {
  if (!slug) return null
  return INDUSTRIES.find((i) => i.slug === slug) ?? null
}

/** Matches a label the visitor picked from the buttons, which is already canonical. */
export function industryByLabel(label: string | undefined | null): Industry | null {
  if (!label) return null
  const key = clean(label)
  return INDUSTRIES.find((i) => clean(i.label) === key) ?? normaliseIndustry(label)
}

/**
 * NiCE's own filtered resource listing for a vertical.
 *
 * Worth linking even though the room has its own industry-tagged assets: this reaches the whole
 * public library rather than the handful curated here. The plural parameter name is not a typo,
 * and the singular form is silently ignored by the site. See tools/fetch-nice-resource-facets.ps1.
 */
export function resourcesUrl(industry: Industry): string {
  return `https://www.nice.com/resources?industries=${industry.slug}`
}
