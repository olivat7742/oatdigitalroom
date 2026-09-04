import { useEffect } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useSessionStore } from '@/store/useSessionStore'
import { MockTransport } from '@/transport/MockTransport'
import { CognigyTransport } from '@/transport/CognigyTransport'
import { Stage } from '@/components/stage/Stage'
import { TakeawaysTray } from '@/components/stage/TakeawaysTray'
import { ChatRail } from '@/components/chat/ChatRail'
import { CompanyBadge } from '@/components/CompanyBadge'
import { brand } from '@/theme'

/** Set VITE_TRANSPORT=cognigy in app/.env.local to talk to the real agent. */
const USE_LIVE_AGENT = import.meta.env.VITE_TRANSPORT === 'cognigy'

/**
 * Text wordmark standing in for the official NiCE logo.
 *
 * The real logo is an SVG served from nice.com's CDN. I deliberately did not scrape and
 * embed it: logo usage is governed by brand guidelines covering approved files, clear space
 * and minimum sizes, and a customer-facing tool should use the file the brand team issues,
 * not one lifted off the marketing site.
 *
 * To drop it in: save the approved SVG to `src/assets/nice-logo.svg`, import it, and replace
 * the Typography below with an <img>. Nothing else needs to change.
 */
function Wordmark() {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Typography
        component="span"
        sx={{
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: '-0.04em',
          color: brand.black,
          lineHeight: 1,
        }}
      >
        NiCE
      </Typography>
      <Box sx={{ width: '1px', height: 20, bgcolor: brand.hairlineStrong }} />
      <Typography
        component="span"
        sx={{ fontWeight: 300, fontSize: 20, letterSpacing: '-0.02em', color: brand.black }}
      >
        Digital Room
      </Typography>
    </Stack>
  )
}

export function App() {
  const attachTransport = useSessionStore((s) => s.attachTransport)
  const theme = useTheme()
  // Below md the stage stacks above the chat rail. A sales tool gets opened on phones.
  const stacked = useMediaQuery(theme.breakpoints.down('md'))

  useEffect(() => {
    const transport = USE_LIVE_AGENT ? new CognigyTransport() : new MockTransport()
    attachTransport(transport)
    return () => transport.disconnect()
  }, [attachTransport])

  return (
    <Stack
      sx={{
        height: '100dvh',
        bgcolor: brand.gray,
        px: { xs: 1.5, md: 3 },
        py: { xs: 1.5, md: 2 },
        gap: { xs: 1.5, md: 2 },
      }}
    >
      {/* Three fixed columns rather than space-between, so the company badge sits in the true
          centre and does not drift as the chip on the right changes width. Row height is set by
          the wordmark, and CompanyBadge caps its logo below that, so the header cannot grow
          when a logo loads. */}
      <Box
        sx={{
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Wordmark />

        <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <CompanyBadge />
        </Box>

        <Stack direction="row" justifyContent="flex-end" sx={{ minWidth: 0 }}>
          {/* The banner must never let someone mistake unreviewed content for approved
              material, so it stays visible in live mode too. */}
          <Chip
            size="small"
            label={
              USE_LIVE_AGENT
                ? 'Live Cognigy agent, content not yet approved'
                : 'Mock mode, fixture data, not approved content'
            }
            sx={{
              bgcolor: 'transparent',
              border: '1px solid',
              borderColor: brand.pink,
              color: brand.pinkDark,
              fontWeight: 400,
            }}
          />
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: stacked ? '1fr' : 'minmax(0, 1fr) minmax(340px, 420px)',
          gridTemplateRows: stacked ? 'minmax(0, 1.1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
        }}
      >
        {/* The stage column, not just the stage: the takeaways strip sits under it and the
            expanded panel covers the whole column, which is what position: relative anchors. */}
        <Box
          sx={{
            position: 'relative',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Stage />
          </Box>
          <TakeawaysTray />
        </Box>

        <ChatRail />
      </Box>
    </Stack>
  )
}
