import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { useSessionStore } from '@/store/useSessionStore'
import type { StageSummary } from '@/types/stageDirective'
import { formatRuntime } from '@/catalog'
import { brand } from '@/theme'

/**
 * The closing screen: what they watched, what they might want next, and how to carry on with a
 * human.
 *
 * Two things this deliberately does NOT do:
 *
 *  - It does not end the conversation. The chat rail stays live, and any later demo replaces
 *    this panel. Someone who says "bye" and then thinks of one more question should not have
 *    to start again.
 *  - It does not treat a captured email as permission to send one. The address was given so
 *    the visitor could be followed up if they asked; using it because we have it would be a
 *    different purpose from the one they were told. The opt-in below IS the consent, which is
 *    why the send button stays disabled until it is ticked.
 *
 * Every action round-trips through the agent as an ordinary message rather than calling a tool
 * directly, so the conversation transcript stays the single record of what was agreed.
 */
export function SummaryPanel({ summary }: { summary: StageSummary }) {
  const send = useSessionStore((s) => s.sendVisitorMessage)

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(summary.topics.filter((t) => t.preselected).map((t) => t.id)),
  )
  const [emailConsent, setEmailConsent] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)

  const selectedLabels = useMemo(
    () => summary.topics.filter((t) => selected.has(t.id)).map((t) => t.label),
    [summary.topics, selected],
  )

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const act = (message: string, confirmation: string) => {
    send(message)
    setSubmitted(confirmation)
  }

  // Capped so the outgoing message stays readable in the rail. Ticking eight topics otherwise
  // produced a single sentence longer than the summary itself.
  const topicsPhrase =
    selectedLabels.length === 0
      ? 'what we covered'
      : selectedLabels.length <= 5
        ? selectedLabels.join(', ')
        : `${selectedLabels.slice(0, 5).join(', ')} and ${selectedLabels.length - 5} more`

  return (
    <Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
      <Stack spacing={2.5} sx={{ maxWidth: 620 }}>
        <Box>
          <Typography variant="h5" sx={{ color: brand.black }}>
            {summary.headline ?? 'Thanks for visiting the Digital Room'}
          </Typography>
          <Typography variant="body2" sx={{ color: brand.darkGray, mt: 0.75 }}>
            The chat is still open, so ask anything else whenever you like.
          </Typography>
        </Box>

        {/* Who owns the relationship. Absent entirely when no lookup ran, which is the case for
            a NiCE employee browsing for themselves: they are neither a customer nor a lead, and
            telling them an Account Executive will be assigned to them would be nonsense. */}
        {summary.crm && (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: brand.base,
              borderLeft: `3px solid ${summary.crm.status === 'known' ? brand.primary : brand.darkGray}`,
            }}
          >
            {summary.crm.status === 'known' && summary.crm.salesRepName ? (
              <>
                <Typography variant="subtitle2" sx={{ color: brand.black }}>
                  Your NiCE contact
                </Typography>
                <Typography variant="body2" sx={{ color: brand.black, mt: 0.5 }}>
                  {summary.crm.salesRepName}
                  {summary.crm.salesRepRole ? `, ${summary.crm.salesRepRole}` : ''}
                  {summary.crm.accountName ? ` for ${summary.crm.accountName}` : ''}
                </Typography>
                <Typography variant="caption" sx={{ color: brand.darkGray, display: 'block', mt: 0.5 }}>
                  They already work with your organisation, so anything you ask for here reaches
                  someone who knows the account.
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="subtitle2" sx={{ color: brand.black }}>
                  An Account Executive will be assigned
                </Typography>
                <Typography variant="body2" sx={{ color: brand.darkGray, mt: 0.5 }}>
                  You are new to us, so there is no named contact yet. Someone will be assigned to
                  your account shortly and will pick up from what you looked at here.
                </Typography>
              </>
            )}
          </Box>
        )}

        {summary.viewed.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ color: brand.black, mb: 1 }}>
              What you looked at
            </Typography>
            <Stack spacing={0.75}>
              {summary.viewed.map((item) => (
                <Stack
                  key={item.assetId}
                  direction="row"
                  alignItems="baseline"
                  spacing={1}
                  sx={{ flexWrap: 'wrap', rowGap: 0.25 }}
                >
                  {item.watchUrl ? (
                    <Link
                      href={item.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2"
                      sx={{ color: brand.primaryDark, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}
                    >
                      {item.title}
                      <OpenInNewRoundedIcon sx={{ fontSize: 12 }} />
                    </Link>
                  ) : (
                    <Typography variant="body2" sx={{ color: brand.black }}>
                      {item.title}
                    </Typography>
                  )}
                  {item.durationSeconds ? (
                    <Typography variant="caption" sx={{ color: brand.darkGray }}>
                      {formatRuntime(item.durationSeconds)}
                    </Typography>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {summary.topics.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ color: brand.black }}>
              What would you like to explore?
            </Typography>
            <Typography variant="caption" sx={{ color: brand.darkGray, display: 'block', mb: 0.5 }}>
              Ticked ones are what you already looked at. Add or remove anything.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                columnGap: 1,
              }}
            >
              {summary.topics.map((topic) => (
                <FormControlLabel
                  key={topic.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={selected.has(topic.id)}
                      onChange={() => toggle(topic.id)}
                      sx={{ color: brand.hairlineStrong, '&.Mui-checked': { color: brand.primaryDark } }}
                    />
                  }
                  label={<Typography variant="body2">{topic.label}</Typography>}
                  sx={{ mr: 0, alignItems: 'center' }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ borderColor: brand.hairline }} />

        <Box>
          <Typography variant="subtitle2" sx={{ color: brand.black, mb: 1 }}>
            Take it further
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={emailConsent}
                onChange={(event) => setEmailConsent(event.target.checked)}
                sx={{ color: brand.hairlineStrong, '&.Mui-checked': { color: brand.primaryDark } }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: brand.black }}>
                Yes, email me documentation links on the topics I ticked
              </Typography>
            }
            sx={{ alignItems: 'flex-start', mt: -0.5 }}
          />
          <Typography variant="caption" sx={{ color: brand.darkGray, display: 'block', ml: 3.75, mb: 1.5 }}>
            {summary.emailKnown
              ? 'Sent to the address you gave earlier. We will not use it for anything else without asking.'
              : 'You have not given an email yet, so the guide will ask for one.'}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<MailOutlineRoundedIcon />}
              disabled={!emailConsent || submitted !== null}
              onClick={() =>
                act(
                  `Please email me documentation links about: ${topicsPhrase}. I confirm you can contact me at my email for this.`,
                  'Asked for the documentation links by email.',
                )
              }
            >
              Email me the links
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<ChatBubbleOutlineRoundedIcon />}
              disabled={submitted !== null}
              onClick={() =>
                act(
                  `I would like to speak with a NiCE sales representative about: ${topicsPhrase}.`,
                  'Asked to speak with a sales representative.',
                )
              }
              sx={{ borderColor: brand.hairlineStrong, color: brand.black }}
            >
              Speak with a sales rep
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<PhoneInTalkRoundedIcon />}
              disabled={submitted !== null}
              onClick={() =>
                act(
                  `Please arrange a callback to discuss: ${topicsPhrase}.`,
                  'Asked for a callback.',
                )
              }
              sx={{ borderColor: brand.hairlineStrong, color: brand.black }}
            >
              Request a callback
            </Button>
          </Stack>

          {submitted && (
            <Typography variant="body2" sx={{ color: brand.primaryDark, mt: 1.5, fontWeight: 500 }}>
              {submitted} The guide has picked it up in the chat.
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  )
}
