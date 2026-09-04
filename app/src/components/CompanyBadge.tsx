import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useSessionStore } from '@/store/useSessionStore'
import { logoCandidates, resolveCompanyDomain } from '@/company'
import { brand } from '@/theme'

/** Header height budget. The logo is capped to this so the header can never grow. */
const LOGO_HEIGHT = 26
const LOGO_MAX_WIDTH = 150

/**
 * The visitor's company, shown in the middle of the header once the agent has identified them.
 *
 * Renders nothing at all until there is a company, so the header is unchanged for an
 * unidentified visitor rather than showing an empty slot.
 *
 * The logo is resolved from the email domain, never from the company name. See app/src/company.ts
 * for why that distinction matters. If no icon service has the domain, the company name is shown
 * as text instead: a wrong logo would be far worse than no logo in a sales tool.
 */
export function CompanyBadge() {
  const visitor = useSessionStore((s) => s.visitor)

  // When a NiCE employee is preparing for a customer, the header follows the CUSTOMER, not the
  // employee. Showing a colleague the NiCE logo tells them nothing, and the whole session is
  // being conducted as if that customer were the visitor, so the chrome should agree.
  const onBehalfOf = visitor?.audience === 'nice-on-behalf' ? visitor.onBehalfOf : undefined

  const company = (onBehalfOf?.company ?? visitor?.company)?.trim() ?? ''
  const subjectEmail = onBehalfOf ? undefined : visitor?.email
  const subjectWebsite = onBehalfOf?.website ?? visitor?.website

  const identity = useMemo(
    () => resolveCompanyDomain({ email: subjectEmail, website: subjectWebsite }),
    [subjectEmail, subjectWebsite],
  )

  const candidates = useMemo(
    () => (identity.domain ? logoCandidates(identity.domain) : []),
    [identity.domain],
  )

  // Walks the candidate list on error. Both services 404 on an unknown domain, so onError is a
  // reliable signal rather than a guess.
  const [candidateIndex, setCandidateIndex] = useState(0)
  useEffect(() => {
    setCandidateIndex(0)
  }, [identity.domain])

  if (!company && !identity.domain) return null

  const logoUrl = candidates[candidateIndex]
  const exhausted = candidateIndex >= candidates.length

  const label = company || identity.domain || ''
  const source = onBehalfOf
    ? 'the customer website given'
    : visitor?.website
      ? 'the website given'
      : 'the email domain'
  const tooltip = identity.domain
    ? `${label} · logo resolved from ${source} ${identity.domain}`
    : `${label} · no company domain available${identity.reason === 'generic-provider' ? ', the email is a personal provider' : ''}`

  return (
    <Tooltip title={tooltip} arrow placement="bottom">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ minWidth: 0, maxWidth: { xs: 160, md: 320 }, overflow: 'hidden' }}
      >
        {logoUrl && !exhausted && (
          <Box
            component="img"
            src={logoUrl}
            alt={`${label} logo`}
            onError={() => setCandidateIndex((index) => index + 1)}
            sx={{
              height: LOGO_HEIGHT,
              maxHeight: LOGO_HEIGHT,
              maxWidth: LOGO_MAX_WIDTH,
              width: 'auto',
              // contain, so a wide wordmark scales down rather than being cropped, and a
              // square favicon is not stretched.
              objectFit: 'contain',
              display: 'block',
              flexShrink: 0,
              borderRadius: 0.5,
            }}
          />
        )}
        {label && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: brand.black,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {label}
          </Typography>
        )}
      </Stack>
    </Tooltip>
  )
}
