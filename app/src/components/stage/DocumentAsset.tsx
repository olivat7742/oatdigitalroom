import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { hasRealSource, type StageAsset } from '@/types/stageDirective'
import { brand } from '@/theme'

/**
 * Renderer for document assets: NiCE resources such as case studies, white papers and
 * datasheets.
 *
 * Three decisions worth keeping.
 *
 * It PROPOSES rather than embeds. These pages carry no X-Frame-Options and no CSP
 * frame-ancestors, so they could legally be iframed, and doing so would be worse: the visitor
 * would get NiCE's site navigation, cookie banner and footer inside a 60% pane, and any
 * gated-download form would be unusable at that width. A card that says what the document is
 * and opens it properly respects both the content and the reader.
 *
 * It shows the publisher's own description, not a generated one. The summary comes from the
 * resource's own og:description via the catalog. A visitor deciding whether to spend ten
 * minutes reading something deserves the author's framing rather than the agent's paraphrase.
 *
 * Badges are facts or absent. Content type and industries come from NiCE's listing taxonomy,
 * and the build refuses any document whose type was inferred, so nothing here is a guess
 * dressed as a label.
 */
export function DocumentAsset({ asset }: { asset: StageAsset }) {
  const href = asset.watchUrl ?? (hasRealSource(asset) ? asset.src : undefined)

  if (!href) {
    return (
      <Stack
        sx={{
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          bgcolor: brand.base,
        }}
        spacing={1}
      >
        <Typography variant="body1" sx={{ color: brand.black }}>
          No source resolved for <strong>{asset.id}</strong>
        </Typography>
        <Typography variant="body2" sx={{ color: brand.darkGray }}>
          The catalog entry exists but its URL is still a placeholder.
        </Typography>
      </Stack>
    )
  }

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={3}
      sx={{
        height: '100%',
        minHeight: 0,
        p: { xs: 2.5, md: 3.5 },
        borderRadius: 3,
        bgcolor: brand.base,
        overflow: 'auto',
        alignItems: { xs: 'stretch', md: 'center' },
      }}
    >
      {/* The cover. flexShrink 0 so a tall thumbnail cannot squeeze the text column away. */}
      <Box
        sx={{
          flexShrink: 0,
          width: { xs: '100%', md: 320 },
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: brand.stage,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '16 / 9',
        }}
      >
        {asset.posterUrl ? (
          <Box
            component="img"
            src={asset.posterUrl}
            alt=""
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <DescriptionOutlinedIcon sx={{ fontSize: 64, color: brand.primary }} />
        )}
      </Box>

      <Stack spacing={2} sx={{ minWidth: 0 }}>
        {asset.badges?.length ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {asset.badges.map((badge) => (
              <Chip
                key={badge}
                size="small"
                label={badge}
                sx={{ bgcolor: brand.primary, color: brand.black, fontWeight: 500 }}
              />
            ))}
          </Stack>
        ) : null}

        <Typography variant="h5" sx={{ color: brand.black }}>
          {asset.title ?? asset.id}
        </Typography>

        {asset.summary ? (
          <Typography variant="body1" sx={{ color: brand.darkGray }}>
            {asset.summary}
          </Typography>
        ) : null}

        <Box>
          <Button
            variant="contained"
            href={href}
            target="_blank"
            // noopener because target=_blank otherwise hands the opened page a window.opener
            // handle back into this one. noreferrer keeps the visitor's path here out of
            // nice.com's referrer logs, which is not ours to disclose.
            rel="noopener noreferrer"
            endIcon={<OpenInNewRoundedIcon />}
            // color is explicit, not decorative. A contained Button takes its text colour from
            // the theme's contrast for primary, which in this palette is near-black, so
            // overriding only bgcolor rendered the label black on black and invisible.
            sx={{
              bgcolor: brand.black,
              color: brand.white,
              '&:hover': { bgcolor: brand.primaryDark, color: brand.white },
            }}
          >
            Read on nice.com
          </Button>
        </Box>

        {/* Says where the link goes before it is clicked, and marks this as NiCE's own
            published material rather than something assembled here. */}
        <Typography variant="caption" sx={{ color: brand.darkGray }}>
          Opens nice.com in a new tab
        </Typography>
      </Stack>
    </Stack>
  )
}
