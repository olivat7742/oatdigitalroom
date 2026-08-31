import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { useSessionStore } from '@/store/useSessionStore'
import type { StageAsset } from '@/types/stageDirective'
import { brand } from '@/theme'

/** Mount with key={asset.id} so step position resets with a new asset. */
export function WalkthroughAsset({ asset }: { asset: StageAsset }) {
  const stepIndex = useSessionStore((s) => s.stage.stepIndex)
  const highlighted = useSessionStore((s) => s.stage.highlighted)
  const setStepIndex = useSessionStore((s) => s.setStepIndex)

  const steps = asset.steps ?? []
  const safeIndex = Math.min(Math.max(0, stepIndex), Math.max(0, steps.length - 1))
  const step = steps[safeIndex]

  if (!step) {
    return (
      <Typography variant="body2" sx={{ color: brand.darkGray }}>
        This walkthrough has no steps configured.
      </Typography>
    )
  }

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }} spacing={2}>
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: brand.stage,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          component="img"
          src={step.imageUrl}
          alt={step.caption}
          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />

        {step.hotspot && (
          <Box
            sx={{
              position: 'absolute',
              left: `${step.hotspot.x * 100}%`,
              top: `${step.hotspot.y * 100}%`,
              width: `${step.hotspot.w * 100}%`,
              height: `${step.hotspot.h * 100}%`,
              border: '2px solid',
              borderColor: brand.mint,
              borderRadius: 2,
              boxShadow: highlighted
                ? '0 0 0 9999px rgba(34,33,43,0.66)'
                : '0 0 0 9999px rgba(34,33,43,0.3)',
              transition: 'box-shadow 240ms ease',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

      <Typography variant="body1" sx={{ color: brand.black, minHeight: 48 }}>
        {step.caption}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ChevronLeftRoundedIcon />}
          disabled={safeIndex === 0}
          onClick={() => setStepIndex(safeIndex - 1)}
          sx={{ borderColor: brand.hairlineStrong, color: brand.black }}
        >
          Back
        </Button>

        <Stack direction="row" spacing={0.75} sx={{ flex: 1, justifyContent: 'center' }}>
          {steps.map((_, index) => (
            <Box
              key={index}
              onClick={() => setStepIndex(index)}
              sx={{
                width: index === safeIndex ? 24 : 8,
                height: 8,
                borderRadius: 999,
                cursor: 'pointer',
                bgcolor: index === safeIndex ? brand.primary : brand.hairlineStrong,
                transition: 'width 160ms ease',
              }}
            />
          ))}
        </Stack>

        <Button
          size="small"
          variant="contained"
          endIcon={<ChevronRightRoundedIcon />}
          disabled={safeIndex >= steps.length - 1}
          onClick={() => setStepIndex(safeIndex + 1)}
        >
          Next
        </Button>
      </Stack>
    </Stack>
  )
}
