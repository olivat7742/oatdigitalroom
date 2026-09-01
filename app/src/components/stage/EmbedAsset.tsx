import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { useSessionStore } from '@/store/useSessionStore'
import type { StageAsset } from '@/types/stageDirective'
import { brand } from '@/theme'
import { formatRuntime } from '@/catalog'

/**
 * Third-party player in an iframe, currently YouTube.
 *
 * Two deliberate differences from VideoAsset, both consequences of not owning the player:
 *
 *  - `position` is applied as a load-time start offset in the URL, not a live seek. Seeking a
 *    loaded frame would need the provider's JS API, which is not worth the dependency here.
 *  - There are no transport controls, no chapter markers and no talk-track narration, because
 *    the host page cannot read playback state across the iframe boundary.
 *
 * Uses youtube-nocookie.com, which is the privacy-preserving embed domain. Do not switch it to
 * youtube.com: this page is public and there is no reason to set advertising cookies on
 * visitors who only came to watch a product video.
 */
export function EmbedAsset({ asset }: { asset: StageAsset }) {
  const seek = useSessionStore((s) => s.stage.seek)
  const playing = useSessionStore((s) => s.stage.playing)

  const startSeconds = Math.max(0, Math.floor(seek?.position ?? 0))

  const src = useMemo(() => {
    if (!asset.src) return null
    try {
      const url = new URL(asset.src)
      if (startSeconds > 0) url.searchParams.set('start', String(startSeconds))
      if (playing) url.searchParams.set('autoplay', '1')
      url.searchParams.set('rel', '0')
      url.searchParams.set('modestbranding', '1')
      return url.toString()
    } catch {
      return asset.src
    }
  }, [asset.src, startSeconds, playing])

  if (!src) {
    return (
      <Stack sx={{ height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 3, bgcolor: brand.base }}>
        <Typography variant="body1" sx={{ color: brand.black }}>
          No embed URL resolved for <strong>{asset.id}</strong>
        </Typography>
      </Stack>
    )
  }

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }} spacing={1.5}>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: brand.stage,
        }}
      >
        <Box
          component="iframe"
          // Remount when the start offset changes: the offset is baked into the URL, so
          // without a new key the provider keeps playing from where it already was.
          key={`${asset.id}:${startSeconds}`}
          src={src}
          title={asset.title ?? asset.id}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sx={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </Box>

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        <Typography variant="caption" sx={{ color: brand.darkGray }}>
          Published publicly by NiCE
          {asset.durationSeconds ? ` · ${formatRuntime(asset.durationSeconds)}` : ''}
          {startSeconds > 0 ? ` · starting at ${Math.floor(startSeconds / 60)}:${String(startSeconds % 60).padStart(2, '0')}` : ''}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {asset.watchUrl && (
          <Link
            href={asset.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            sx={{ color: brand.primaryDark, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            Watch on YouTube <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
          </Link>
        )}
      </Stack>
    </Stack>
  )
}
