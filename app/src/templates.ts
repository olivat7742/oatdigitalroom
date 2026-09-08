/**
 * Look and feel presets, selected by ?t= and resolved through an allowlist.
 *
 * Presets live in catalog/templates.json so an event can be dressed without touching code.
 * Only the fields named below are copied through: the JSON is data, and a template can change
 * colours and copy but cannot introduce a URL, a path or a style string of its own.
 */

import raw from '@catalog/templates.json'
import { roomParams } from '@/roomParams'

/** The subset of brand tokens a template is allowed to override. Deliberately small. */
export interface TemplatePalette {
  primary?: string
  primaryDark?: string
  /**
   * Text and icon colour ON the primary. Overridable because it is an accessibility
   * consequence of the primary, not decoration: the default room's #3694fd is light enough to
   * carry black text, and a darker event primary is not. Getting this wrong produces a
   * contained button with unreadable text, which has already happened once in this project.
   */
  primaryContrast?: string
  stage?: string
  /** A CSS gradient for the top accent band. The only place a template supplies CSS. */
  accentGradient?: string
}

export interface RoomTemplate {
  slug: string
  label: string
  /** Shown next to the NiCE wordmark, as text. See catalog/templates.json on logo files. */
  wordmark: string
  /** Replaces the first line of the greeting, or null to keep the default. */
  welcome: string | null
  palette: TemplatePalette
}

interface RawTemplate {
  label: string
  wordmark: string
  welcome: string | null
  palette: Record<string, unknown>
}

const REGISTRY = raw.templates as Record<string, RawTemplate>

/**
 * Colour values are re-validated here even though they come from our own file.
 *
 * Not paranoia about the file, but about the boundary: this is the last point before a string
 * becomes CSS, and a token that is not a colour should fail visibly in review rather than
 * silently produce a broken rule.
 */
const HEX = /^#[0-9a-f]{3,8}$/i
const GRADIENT = /^linear-gradient\([^;{}]*\)$/i

function palette(source: Record<string, unknown>): TemplatePalette {
  const out: TemplatePalette = {}
  for (const key of ['primary', 'primaryDark', 'primaryContrast', 'stage'] as const) {
    const value = source[key]
    if (typeof value === 'string' && HEX.test(value)) out[key] = value
  }
  const gradient = source['accentGradient']
  if (typeof gradient === 'string' && GRADIENT.test(gradient)) out.accentGradient = gradient
  return out
}

function build(slug: string, entry: RawTemplate): RoomTemplate {
  return {
    slug,
    label: String(entry.label ?? 'NiCE Digital Room'),
    wordmark: String(entry.wordmark ?? 'Digital Room'),
    welcome: typeof entry.welcome === 'string' ? entry.welcome : null,
    palette: palette(entry.palette ?? {}),
  }
}

const DEFAULT_TEMPLATE = build('default', REGISTRY['default'] as RawTemplate)

/**
 * Resolves a slug against the registry.
 *
 * An unknown slug falls back to the default SILENTLY. It is not an error worth telling the
 * visitor about: they did not choose the link, and a room that says "unknown template" is
 * broken in a way a room that just looks normal is not.
 */
export function resolveTemplate(slug: string | null): RoomTemplate {
  if (!slug) return DEFAULT_TEMPLATE
  const entry = REGISTRY[slug]
  if (!entry) return DEFAULT_TEMPLATE
  return build(slug, entry)
}

/** Known slugs, for the tests and for anyone wondering what is on offer. */
export const TEMPLATE_SLUGS = Object.keys(REGISTRY)

/** The template for this page load. */
export const activeTemplate: RoomTemplate = resolveTemplate(roomParams.template)
