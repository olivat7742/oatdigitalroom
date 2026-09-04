import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import TurnedInNotRoundedIcon from '@mui/icons-material/TurnedInNotRounded'
import { useSessionStore } from '@/store/useSessionStore'
import { SummaryPanel } from './SummaryPanel'
import { useLeaveIntent } from '@/hooks/useLeaveIntent'
import { industryByLabel, resourcesUrl } from '@/industries'
import { formatRuntime } from '@/catalog'
import { brand } from '@/theme'

/**
 * The takeaways tray: one component, two states.
 *
 * WHAT PROBLEM IT SOLVES
 * The closing summary was reachable only by saying goodbye, and a visitor who simply closed the
 * tab took nothing with them. Worse, there was no way to see what had accumulated without
 * ending the conversation to find out. So the tray is permanent: a strip that is always there
 * and counts what you have collected, expanding into the panel itself.
 *
 * Collapsed, it is a strip along the bottom of the stage: how many things you have looked at,
 * the shortcut to your own industry, and one button that asks the guide to wrap up. Expanded, it
 * covers the stage and shows either the agent's closing summary, once there is one, or a live
 * view of what you have collected so far.
 *
 * The summary is rendered HERE and nowhere else. It used to live on the stage, and having it in
 * two places would mean two panels drifting apart. Keeping the stage asset underneath also
 * means dismissing the tray returns the visitor to whatever they were watching, which is what
 * makes the panel dismissible rather than terminal.
 *
 * The wrap-up button asks the AGENT, as an ordinary message, rather than assembling a summary
 * locally. The agent is the one that knows what was discussed, and the transcript stays the
 * single record of what was agreed.
 */

/** Phrased as a request the guide can answer, and matched by the mock transport's farewell rule. */
const WRAP_UP_MESSAGE = 'Wrap up and show me my takeaways'

/**
 * The vertical shortcut, offered wherever the tray is visible.
 *
 * Two different things, deliberately not merged. The first asks the guide for the room's own
 * curated assets for that industry, which is a conversation. The second is NiCE's public
 * filtered listing, which reaches the whole library rather than the handful curated here, and is
 * a plain external link because that is what it is.
 *
 * Renders nothing when the vertical is unknown, which is a normal outcome: CRM often cannot say
 * and the visitor is allowed to decline the question. A shortcut to a guessed industry would be
 * worse than no shortcut.
 */
function IndustryShortcut({ compact = false }: { compact?: boolean }) {
  const label = useSessionStore((s) => s.visitor?.industry)
  const send = useSessionStore((s) => s.sendVisitorMessage)
  const setTrayOpen = useSessionStore((s) => s.setTrayOpen)

  const industry = industryByLabel(label)
  if (!industry) return null

  const ask = () => {
    send(`Show me ${industry.label} customer stories`)
    // The answer lands on the stage, so the panel gets out of the way to let them see it.
    setTrayOpen(false)
  }

  if (compact) {
    return (
      <Chip
        size="small"
        label={`${industry.label} stories`}
        onClick={ask}
        sx={{
          bgcolor: 'transparent',
          border: '1px solid',
          borderColor: brand.hairlineStrong,
          color: brand.black,
          '&:hover': { bgcolor: brand.base },
        }}
      />
    )
  }

  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: brand.base }}>
      <Typography variant="subtitle2" sx={{ color: brand.black }}>
        Because you are in {industry.label}
      </Typography>
      <Typography variant="caption" sx={{ color: brand.darkGray, display: 'block', mt: 0.5, mb: 1.25 }}>
        Your industry is the strongest filter we have on what is worth your time.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button variant="contained" size="small" onClick={ask}>
          {industry.label} stories in the room
        </Button>
        <Button
          variant="outlined"
          size="small"
          component={Link}
          href={resourcesUrl(industry)}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
          sx={{ borderColor: brand.hairlineStrong, color: brand.black }}
        >
          All of NiCE's {industry.label} resources
        </Button>
      </Stack>
    </Box>
  )
}

/**
 * What the tray shows before the guide has produced a summary.
 *
 * Built from the client-side `seen` list, so it is honest and immediate: exactly the things the
 * stage has shown, with the links that are genuinely public. It makes no attempt to imitate the
 * closing summary's follow-up actions, because those need the topic list the agent decides.
 */
function LiveTakeaways() {
  const seen = useSessionStore((s) => s.seen)
  const send = useSessionStore((s) => s.sendVisitorMessage)

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 620 }}>
      <Box>
        <Typography variant="h5" sx={{ color: brand.black }}>
          Your takeaways so far
        </Typography>
        <Typography variant="body2" sx={{ color: brand.darkGray, mt: 0.75 }}>
          This builds as we go. When you are ready, I can turn it into something you can keep.
        </Typography>
      </Box>

      <IndustryShortcut />

      <Box>
        <Typography variant="subtitle2" sx={{ color: brand.black, mb: 1 }}>
          What you have looked at
        </Typography>
        {seen.length === 0 ? (
          <Typography variant="body2" sx={{ color: brand.darkGray }}>
            Nothing yet. Ask the guide a question and whatever it brings up will be listed here.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {seen.map((item) => (
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
                    sx={{
                      color: brand.primaryDark,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.4,
                    }}
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
        )}
      </Box>

      <Divider sx={{ borderColor: brand.hairline }} />

      <Box>
        <Button variant="contained" size="small" onClick={() => send(WRAP_UP_MESSAGE)}>
          Get my takeaways
        </Button>
        <Typography variant="caption" sx={{ color: brand.darkGray, display: 'block', mt: 1 }}>
          The guide puts together what you looked at and how you would like to follow up. The
          chat stays open either way, so this does not end anything.
        </Typography>
      </Box>
    </Stack>
  )
}

export function TakeawaysTray() {
  const summary = useSessionStore((s) => s.stage.summary)
  const seen = useSessionStore((s) => s.seen)
  const open = useSessionStore((s) => s.trayOpen)
  const nudged = useSessionStore((s) => s.wrapUpNudge)
  const playing = useSessionStore((s) => s.stage.playing)
  const introductionComplete = useSessionStore((s) => s.visitor?.introductionComplete)
  const setTrayOpen = useSessionStore((s) => s.setTrayOpen)
  const nudgeWrapUp = useSessionStore((s) => s.nudgeWrapUp)
  const send = useSessionStore((s) => s.sendVisitorMessage)

  // Watched only once the introduction is over and nothing is playing. During the introduction
  // there are no takeaways to offer, and every message sent would be swallowed as an answer to
  // the question on screen. While a video plays, sitting still IS the activity.
  useLeaveIntent(nudgeWrapUp, Boolean(introductionComplete) && !open && !playing)

  // Hidden entirely until the introduction is answered, for the same reason: a strip offering
  // takeaways before anything has been shown is furniture, and its button would be read as an
  // answer to whichever question is on screen.
  if (!introductionComplete) return null

  if (open) {
    return (
      <Paper
        elevation={8}
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          bgcolor: brand.white,
          borderRadius: 3,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: brand.hairline }}
        >
          <TurnedInNotRoundedIcon sx={{ fontSize: 18, color: brand.primaryDark }} />
          <Typography variant="subtitle2" sx={{ color: brand.black, flex: 1 }}>
            Your takeaways
          </Typography>
          <IconButton size="small" onClick={() => setTrayOpen(false)} aria-label="Close takeaways">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2.5 }}>
          {summary ? (
            <Stack spacing={2.5} sx={{ maxWidth: 620 }}>
              {/* Above the panel rather than inside it: the shortcut is about who the visitor
                  is, and SummaryPanel is about this one conversation. */}
              <IndustryShortcut />
              <SummaryPanel summary={summary} />
            </Stack>
          ) : (
            <LiveTakeaways />
          )}
        </Box>
      </Paper>
    )
  }

  // The collapsed strip sits IN the flow beneath the stage rather than floating over it. An
  // overlay would cover the bottom of whatever is on the stage, which on a video is the player
  // controls.
  return (
    <Paper
      elevation={0}
      sx={{
        flexShrink: 0,
        px: 2,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        rowGap: 1,
        border: '1px solid',
        borderColor: nudged ? brand.primary : 'transparent',
        borderRadius: 3,
        bgcolor: nudged ? brand.wash : brand.white,
      }}
    >
      <Button
        size="small"
        onClick={() => setTrayOpen(true)}
        startIcon={<ExpandLessRoundedIcon />}
        sx={{ color: brand.black, minWidth: 0 }}
      >
        {nudged
          ? 'Before you go, take these with you'
          : seen.length === 0
            ? 'Your takeaways'
            : `Your takeaways (${seen.length})`}
      </Button>

      <Box sx={{ flex: 1, minWidth: 8 }} />

      <IndustryShortcut compact />

      <Button
        variant={nudged ? 'contained' : 'outlined'}
        size="small"
        onClick={() => send(WRAP_UP_MESSAGE)}
        sx={nudged ? undefined : { borderColor: brand.hairlineStrong, color: brand.black }}
      >
        Get my takeaways
      </Button>
    </Paper>
  )
}
