/**
 * The identity confirmation, owned by the PORTAL in both transports.
 *
 * WHY THE PORTAL AND NOT THE AGENT
 * The live agent was asked to put this question and could not be relied on to. It frequently
 * does not call save_visitor_profile on the opening turn at all, so it greeted from its own
 * instructions and asked for a name the invitation had already given us. Worse, on the turn it
 * did call the tool it passed the confirmation ITSELF, accepting an identity nobody in the room
 * had agreed to. A forwarded invitation would have been silently accepted.
 *
 * So consent is not a model decision. The portal asks, deterministically, before the
 * conversation starts, and the agent is handed an identity that is already settled. The node
 * keeps a gated fallback path for any channel that does not pre-confirm, but in this product
 * that path is not the one used.
 *
 * Shared by MockTransport and CognigyTransport so the two cannot drift on the wording, the
 * buttons, or what counts as a refusal.
 */

import type { Cta } from '@/types/stageDirective'

/**
 * The two buttons.
 *
 * "Not me" is a real choice and not a formality: people forward invitations, and without it a
 * colleague opening someone else's link would be addressed by the wrong name all the way to
 * the closing page and filed against the wrong contact.
 */
export const IDENTITY_CTA: Cta[] = [
  { label: "Yes, that's me", value: "Yes, that's me", kind: 'quick_reply' },
  { label: 'Not me', value: 'Not me', kind: 'quick_reply' },
]

/**
 * The question.
 *
 * Shows the NAME and the COMPANY and deliberately not the email or the role. Reading someone
 * their own email address back proves nothing they did not already know and makes the room
 * feel like it has been reading their file.
 */
export function identityQuestion(firstName: string, company?: string): string {
  const at = company ? ` at ${company}` : ''
  return `Welcome back, ${firstName}. I have you down as being${at}, so I can skip most of the questions. Is that right?`
}

/**
 * Whether an answer refuses the claimed identity.
 *
 * Anything that is not clearly a refusal counts as acceptance, because the buttons say "Yes,
 * that's me" and "Not me" and the two mistakes do not cost the same. A wrongly discarded
 * identity costs three questions. A wrongly accepted one files the session against a stranger.
 */
export function isIdentityRejection(answer: string): boolean {
  return /\b(not me|no|nope|wrong|isn'?t me|is not me|someone else|different)\b/i.test(answer)
}
