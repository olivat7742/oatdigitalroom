import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import type { Message, MessageSource } from '@/store/useSessionStore'
import type { AssetReference } from '@/types/stageDirective'
import { brand } from '@/theme'
import { formatRuntime } from '@/catalog'

/**
 * Further reading under an agent reply, so the visitor can bookmark something and come back.
 *
 * Deliberately quiet: caption sized and muted, below the answer rather than competing with it.
 * A visitor who wants to keep reading will look for this; one who does not should barely
 * notice it. Every reply gets one, including refusals, because those are the replies where a
 * visitor most wants somewhere else to look.
 */
function ReferenceLinks({ references }: { references: AssetReference[] }) {
  if (references.length === 0) return null

  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={0.75}
      sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'rgba(34, 33, 43, 0.10)' }}
    >
      <MenuBookRoundedIcon sx={{ fontSize: 13, color: brand.darkGray, mt: '2px', flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: brand.darkGray, mr: 0.5 }}>
          More detail:
        </Typography>
        {references.map((reference, index) => (
          <Box component="span" key={reference.url}>
            {index > 0 && (
              <Typography component="span" variant="caption" sx={{ color: brand.darkGray, mx: 0.5 }}>
                ·
              </Typography>
            )}
            <Link
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="caption"
              sx={{
                color: brand.primaryDark,
                textDecorationColor: 'rgba(44, 121, 238, 0.35)',
                whiteSpace: 'nowrap',
              }}
            >
              {reference.label}
            </Link>
          </Box>
        ))}
      </Box>
    </Stack>
  )
}

/**
 * Citation under an agent reply, so the visitor can bookmark it and come back later.
 *
 * Renders a real link only when the asset has a public address. Local assets are served from
 * the dev media route, which is meaningless outside this machine, so they show a muted note
 * instead. Offering a link that dies the moment it is bookmarked would be worse than offering
 * none, and it would quietly mislead a prospect about what they can keep.
 */
function SourceCitation({ source }: { source: MessageSource }) {
  const runtime = source.durationSeconds ? formatRuntime(source.durationSeconds) : null

  if (!source.url) {
    return (
      <Tooltip
        title="This asset is served locally and has no public address yet. Add source.watchUrl in the catalog once one exists."
        arrow
        placement="top-start"
      >
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1, cursor: 'help' }}>
          <PlayCircleOutlineRoundedIcon sx={{ fontSize: 14, color: brand.darkGray }} />
          <Typography variant="caption" sx={{ color: brand.darkGray }}>
            Source: {source.title}
            {runtime ? ` · ${runtime}` : ''} · no public link yet
          </Typography>
        </Stack>
      </Tooltip>
    )
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={{
        mt: 1,
        pt: 1,
        borderTop: '1px solid',
        borderColor: 'rgba(34, 33, 43, 0.10)',
      }}
    >
      <PlayCircleOutlineRoundedIcon sx={{ fontSize: 15, color: brand.primaryDark }} />
      <Link
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        variant="caption"
        sx={{
          color: brand.primaryDark,
          fontWeight: 500,
          textDecorationColor: 'rgba(44, 121, 238, 0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          minWidth: 0,
        }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.title}
        </Box>
        <OpenInNewRoundedIcon sx={{ fontSize: 12, flexShrink: 0 }} />
      </Link>
      {runtime && (
        <Typography variant="caption" sx={{ color: brand.darkGray, flexShrink: 0 }}>
          · {runtime}
        </Typography>
      )}
    </Stack>
  )
}

/**
 * Narration is styled distinctly from ordinary agent speech.
 *
 * It is authored talk track fired on a chapter boundary rather than a reply to something the
 * visitor said. Making that visually distinct keeps the conversation honest about what is a
 * response and what is a caption. It uses the NiCE pink so it reads as a different voice
 * without introducing a colour that is not in the brand palette.
 */
export function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'narration') {
    return (
      <Box sx={{ pl: 1.75, borderLeft: '2px solid', borderColor: brand.pink, py: 0.25 }}>
        <Typography
          variant="caption"
          sx={{ color: brand.pinkDark, fontWeight: 500, letterSpacing: 0.8, display: 'block' }}
        >
          NARRATING
        </Typography>
        <Typography variant="body2" sx={{ color: brand.darkGray, whiteSpace: 'pre-wrap' }}>
          {message.text}
        </Typography>
      </Box>
    )
  }

  const isVisitor = message.role === 'visitor'

  return (
    <Stack direction="row" sx={{ justifyContent: isVisitor ? 'flex-end' : 'flex-start' }}>
      <Box
        sx={{
          maxWidth: '88%',
          minWidth: 0,
          px: 2,
          py: 1.25,
          // Mirrors the two nice.com button treatments: primary blue with near-black text,
          // and a soft neutral surface.
          borderRadius: isVisitor ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          bgcolor: isVisitor ? brand.primary : brand.base,
          color: brand.black,
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: brand.black }}>
          {message.text}
        </Typography>
        {message.source && <SourceCitation source={message.source} />}
        {!isVisitor && message.references && <ReferenceLinks references={message.references} />}
      </Box>
    </Stack>
  )
}
