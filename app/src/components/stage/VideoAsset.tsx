import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import { useSessionStore } from '@/store/useSessionStore'
import { hasRealSource, type StageAsset } from '@/types/stageDirective'
import { formatTime, usePlaybackClock } from '@/hooks/usePlaybackClock'
import { brand } from '@/theme'

/**
 * Mount with key={asset.id} so a new asset resets all internal playback state.
 *
 * The video surround uses NiCE's own black rather than the light page background. Video
 * needs a dark surface to read properly, and #22212b keeps that on brand instead of
 * introducing a neutral that is not in the palette.
 */
export function VideoAsset({ asset }: { asset: StageAsset }) {
  const playing = useSessionStore((s) => s.stage.playing)
  const storeSeek = useSessionStore((s) => s.stage.seek)
  const setPlaying = useSessionStore((s) => s.setPlaying)
  const enterChapter = useSessionStore((s) => s.enterChapter)

  const mediaRef = useRef<HTMLVideoElement | null>(null)
  const nonceRef = useRef(0)
  const [seekRequest, setSeekRequest] = useState<{ position: number; nonce: number } | null>(null)

  const chapters = useMemo(() => asset.chapters ?? [], [asset.chapters])
  const duration = asset.durationSeconds ?? 0
  const realSource = hasRealSource(asset)

  const requestSeek = useCallback((position: number) => {
    nonceRef.current += 1
    setSeekRequest({ position, nonce: nonceRef.current })
  }, [])

  // Mirror agent-issued seeks into the local request channel, so agent seeks and visitor
  // scrubbing go through exactly one code path.
  useEffect(() => {
    if (storeSeek) requestSeek(storeSeek.position)
  }, [storeSeek, requestSeek])

  const handleEnded = useCallback(() => setPlaying(false), [setPlaying])

  const currentTime = usePlaybackClock({
    playing,
    durationSeconds: duration,
    hasSource: realSource,
    mediaRef,
    seek: seekRequest,
    onEnded: handleEnded,
  })

  const activeChapter = useMemo(() => {
    if (chapters.length === 0) return -1
    let index = 0
    for (let i = 0; i < chapters.length; i += 1) {
      const chapter = chapters[i]
      if (chapter && currentTime >= chapter.t) index = i
    }
    return index
  }, [chapters, currentTime])

  useEffect(() => {
    if (activeChapter >= 0) enterChapter(activeChapter)
  }, [activeChapter, enterChapter])

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  const jumpChapter = (delta: number) => {
    const target = activeChapter + delta
    const chapter = chapters[target]
    if (chapter) requestSeek(chapter.t)
    else if (delta < 0) requestSeek(0)
  }

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          bgcolor: brand.stage,
          borderRadius: 3,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {realSource ? (
          <video
            ref={mediaRef}
            src={asset.src}
            poster={asset.posterUrl}
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <>
            {asset.posterUrl && (
              <Box
                component="img"
                src={asset.posterUrl}
                alt={asset.title ?? asset.id}
                sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
            <Box
              sx={{
                position: 'absolute',
                bottom: 14,
                left: 14,
                px: 1.5,
                py: 0.5,
                borderRadius: 999,
                bgcolor: 'rgba(255,255,255,0.1)',
                border: '1px solid',
                borderColor: brand.pink,
              }}
            >
              <Typography variant="caption" sx={{ color: brand.pink, fontWeight: 500, letterSpacing: 0.6 }}>
                Simulated playback, no media file
              </Typography>
            </Box>
          </>
        )}
      </Box>

      <Stack spacing={1.25} sx={{ pt: 2 }}>
        <Box
          onClick={(event) => {
            if (duration <= 0) return
            const rect = event.currentTarget.getBoundingClientRect()
            const ratio = (event.clientX - rect.left) / rect.width
            requestSeek(Math.min(Math.max(0, ratio), 1) * duration)
          }}
          sx={{
            position: 'relative',
            height: 6,
            borderRadius: 999,
            bgcolor: brand.hairline,
            cursor: duration > 0 ? 'pointer' : 'default',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              width: `${progress}%`,
              bgcolor: brand.primary,
              borderRadius: 999,
              transition: 'width 120ms linear',
            }}
          />
          {chapters.map((chapter, index) => (
            <Tooltip key={`${chapter.t}-${index}`} title={chapter.label} arrow>
              <Box
                onClick={(event) => {
                  event.stopPropagation()
                  requestSeek(chapter.t)
                }}
                sx={{
                  position: 'absolute',
                  top: -4,
                  left: duration > 0 ? `${(chapter.t / duration) * 100}%` : 0,
                  width: 3,
                  height: 14,
                  borderRadius: 999,
                  bgcolor: index === activeChapter ? brand.pink : brand.hairlineStrong,
                  cursor: 'pointer',
                }}
              />
            </Tooltip>
          ))}
        </Box>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton size="small" onClick={() => jumpChapter(-1)} aria-label="Previous chapter">
            <SkipPreviousRoundedIcon fontSize="small" sx={{ color: brand.black }} />
          </IconButton>
          <IconButton
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? 'Pause' : 'Play'}
            sx={{
              bgcolor: brand.primary,
              color: brand.black,
              width: 38,
              height: 38,
              '&:hover': { bgcolor: brand.primaryDark },
            }}
          >
            {playing ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" onClick={() => jumpChapter(1)} aria-label="Next chapter">
            <SkipNextRoundedIcon fontSize="small" sx={{ color: brand.black }} />
          </IconButton>

          <Typography
            variant="caption"
            sx={{ color: brand.darkGray, ml: 1.25, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {chapters[activeChapter] && (
            <Typography variant="caption" sx={{ color: brand.darkGray, textAlign: 'right' }} noWrap>
              {activeChapter + 1}. {chapters[activeChapter]?.label}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Stack>
  )
}
