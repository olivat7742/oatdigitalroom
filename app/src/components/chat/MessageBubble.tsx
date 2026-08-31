import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Message } from '@/store/useSessionStore'
import { brand } from '@/theme'

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
      </Box>
    </Stack>
  )
}
