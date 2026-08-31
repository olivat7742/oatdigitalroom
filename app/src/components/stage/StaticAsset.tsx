import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { hasRealSource, type StageAsset } from '@/types/stageDirective'
import { brand } from '@/theme'

/**
 * Renderer for diagram, comparison and document assets.
 *
 * These three share a shape in the contract: a resolved src that is displayed as-is. They
 * are kept in one component rather than three near-identical ones, and will only be split
 * if their contracts genuinely diverge.
 */
export function StaticAsset({ asset }: { asset: StageAsset }) {
  if (!hasRealSource(asset)) {
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
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        borderRadius: 3,
        overflow: 'auto',
        bgcolor: brand.stage,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        component="img"
        src={asset.src}
        alt={asset.title ?? asset.id}
        sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
      />
    </Box>
  )
}
