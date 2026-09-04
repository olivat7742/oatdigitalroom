import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded'
import { useSessionStore } from '@/store/useSessionStore'
import type { TourInfo } from '@/types/stageDirective'
import { VideoAsset } from './VideoAsset'
import { WalkthroughAsset } from './WalkthroughAsset'
import { StaticAsset } from './StaticAsset'
import { DocumentAsset } from './DocumentAsset'
import { EmbedAsset } from './EmbedAsset'
import { brand } from '@/theme'

function TourProgress({ tour }: { tour: TourInfo }) {
  const percent = (tour.step / tour.totalSteps) * 100
  return (
    <Stack spacing={1} sx={{ pb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Chip
          size="small"
          label={`Step ${tour.step} of ${tour.totalSteps}`}
          sx={{ bgcolor: brand.primary, color: brand.black, fontWeight: 500 }}
        />
        <Typography variant="body2" sx={{ color: brand.darkGray }} noWrap>
          {tour.title ?? tour.id}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percent} sx={{ height: 4 }} />
    </Stack>
  )
}

function EmptyStage() {
  return (
    <Stack
      spacing={2}
      sx={{
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 4,
        borderRadius: 3,
        bgcolor: brand.base,
      }}
    >
      <PlayCircleOutlineRoundedIcon sx={{ fontSize: 52, color: brand.primary }} />
      <Typography variant="h5" sx={{ color: brand.black }}>
        Nothing on the stage yet
      </Typography>
      <Typography variant="body1" sx={{ color: brand.darkGray, maxWidth: 440 }}>
        Ask a question in the chat and the guide will bring the relevant demo, walkthrough or
        diagram up here.
      </Typography>
    </Stack>
  )
}

/**
 * The stage: whatever the guide is currently showing.
 *
 * The closing summary is NOT rendered here. It belongs to TakeawaysTray, which owns both the
 * always-visible strip and the expanded panel, so there is one place a visitor goes to see what
 * they have collected whether or not the conversation has ended. Rendering it in both would
 * mean two copies of the same panel drifting apart.
 */
export function Stage() {
  const asset = useSessionStore((s) => s.stage.asset)
  const tour = useSessionStore((s) => s.tour)

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: brand.white,
        borderRadius: 3,
      }}
    >
      {tour && <TourProgress tour={tour} />}

      {asset && (
        <Typography variant="h5" sx={{ pb: 2, color: brand.black }} noWrap>
          {asset.title ?? asset.id}
        </Typography>
      )}

      <Box sx={{ flex: 1, minHeight: 0 }}>
        {!asset && <EmptyStage />}
        {/* key={asset.id} deliberately remounts renderers so per-asset playback and step
            state resets, rather than being manually cleared in a dozen places. */}
        {asset?.type === 'video' && <VideoAsset key={asset.id} asset={asset} />}
        {asset?.type === 'embed' && <EmbedAsset key={asset.id} asset={asset} />}
        {asset?.type === 'walkthrough' && <WalkthroughAsset key={asset.id} asset={asset} />}
        {/* Documents were previously routed to StaticAsset, which renders an <img>. That is
            right for a diagram and wrong for a document: a resource page is not an image, so
            it rendered as a broken frame. They get a card that proposes and opens them. */}
        {asset?.type === 'document' && <DocumentAsset key={asset.id} asset={asset} />}
        {asset && ['diagram', 'comparison'].includes(asset.type) && (
          <StaticAsset key={asset.id} asset={asset} />
        )}
      </Box>
    </Paper>
  )
}
