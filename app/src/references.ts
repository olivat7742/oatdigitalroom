import type { AssetReference } from '@/types/stageDirective'

/**
 * Fallback references, used on any agent reply that has no asset of its own to cite.
 *
 * The rule this exists to satisfy: a visitor should never reach the end of an answer with
 * nowhere to go for more detail. That includes the replies where the agent deliberately gives
 * them nothing else, such as a pricing refusal or an admission that no demo exists. Those are
 * precisely the moments when a visitor most wants somewhere else to look.
 *
 * Both URLs were verified to resolve. Keep them that way: a dead link under an agent reply is
 * worse than no link, because the visitor only finds out after bookmarking it.
 */
export const DEFAULT_REFERENCES: AssetReference[] = [
  { label: 'NiCE products', url: 'https://www.nice.com/products' },
  { label: 'NiCE product documentation', url: 'https://help.nice-incontact.com' },
  // The Digital Room asks for a name, employer, role and email in its opening turns. The
  // privacy policy has to be reachable at the point of collection, not buried in a footer, so
  // it rides along on every reply that has no asset of its own to cite. That includes the
  // opening turn, which is exactly where the collection happens.
  { label: 'Privacy policy', url: 'https://www.nice.com/company/legal/privacy-policy' },
]
