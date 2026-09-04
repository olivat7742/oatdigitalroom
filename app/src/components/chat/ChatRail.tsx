import { useCallback, useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import { useSessionStore } from '@/store/useSessionStore'
import { MessageBubble } from './MessageBubble'
import { brand } from '@/theme'

function TypingIndicator() {
  return (
    <Stack direction="row" spacing={0.6} sx={{ pl: 1.5, py: 1 }}>
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: brand.darkGray,
            animation: 'showroomBlink 1.2s infinite ease-in-out',
            animationDelay: `${index * 0.16}s`,
            '@keyframes showroomBlink': {
              '0%, 80%, 100%': { opacity: 0.25 },
              '40%': { opacity: 1 },
            },
          }}
        />
      ))}
    </Stack>
  )
}

export function ChatRail() {
  const messages = useSessionStore((s) => s.messages)
  const cta = useSessionStore((s) => s.cta)
  const agentTyping = useSessionStore((s) => s.agentTyping)
  const connection = useSessionStore((s) => s.connection)
  const send = useSessionStore((s) => s.sendVisitorMessage)

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const ctaRef = useRef<HTMLDivElement | null>(null)

  /**
   * Pins the conversation to the bottom.
   *
   * Every detail here is load-bearing, and each one was a version that did not work.
   *
   * The industry question offers twelve buttons, and that strip wraps to four rows, taking a
   * third of the rail. The original smooth scrollIntoView on a trailing element was still
   * animating when the strip resized under it, so the question those buttons belong to ended up
   * scrolled out of sight while the buttons stayed visible: twelve options and no prompt.
   *
   * So: the container, not a child, because the child's own position moves as the strip grows.
   * In a rAF, so the read happens after layout. And INSTANT rather than smooth, because a turn
   * arrives as several state changes in quick succession and each smooth animation cancels the
   * one before it, landing short. The jump is unnoticeable at the pace messages actually arrive.
   */
  const pinToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const container = scrollRef.current
      if (!container) return
      container.scrollTop = container.scrollHeight
    })
  }, [])

  useEffect(() => {
    pinToBottom()
  }, [messages, agentTyping, cta, pinToBottom])

  // The strip's own height changes are not covered by the effect above: cta can stay identical
  // while the rail is resized and the rows reflow. Re-pinning on its resize keeps the newest
  // message visible in that case too.
  useEffect(() => {
    const strip = ctaRef.current
    if (!strip || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(pinToBottom)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [cta, pinToBottom])

  const submit = (text: string) => {
    const value = text.trim()
    if (!value) return
    send(value)
    setDraft('')
  }

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: brand.white,
        borderRadius: 3,
      }}
    >
      {/* overflowX hidden on purpose: citation links used to push the rail sideways rather
          than wrap, which put a horizontal scrollbar under the conversation. */}
      <Stack
        ref={scrollRef}
        spacing={1.75}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', p: 2.5 }}
      >
        {messages.length === 0 && connection !== 'open' && (
          <Typography variant="body2" sx={{ color: brand.darkGray }}>
            Connecting to the guide...
          </Typography>
        )}

        {messages.map((item) => (
          <MessageBubble key={item.id} message={item} />
        ))}

        {agentTyping && <TypingIndicator />}
      </Stack>

      {cta.length > 0 && (
        <Stack
          ref={ctaRef}
          direction="row"
          spacing={1}
          sx={{
            px: 2.5,
            pb: 1.5,
            pt: 1.75,
            flexWrap: 'wrap',
            rowGap: 1,
            borderTop: '1px solid',
            borderColor: brand.hairline,
            // Most turns offer three or four chips and never reach this. The industry picker
            // offers twelve, which wraps to several rows in a narrow rail, and without a
            // ceiling those rows push the conversation itself off the screen.
            maxHeight: '32vh',
            overflowY: 'auto',
          }}
        >
          {cta.map((item, index) => {
            const isHandoff = item.kind === 'handoff'
            // The label is shortened to fit a chip in a narrow rail, so on the long ones the
            // visitor cannot see what they are about to ask for. The full text is the VALUE,
            // which is exactly the question that gets sent.
            const shortened = item.label !== item.value

            return (
              // Always wrapped, so every chip is laid out identically. MUI renders no tooltip
              // for an empty title, which is what a chip that was not shortened gets: a
              // tooltip repeating a fully visible label is noise on every hover.
              <Tooltip
                key={`${item.value}-${index}`}
                title={shortened ? item.value : ''}
                arrow
                placement="top"
              >
                <Chip
                  label={item.label}
                  onClick={() => submit(item.value)}
                  // Spoken in full regardless of the tooltip: a tooltip is hover-only, and a
                  // screen reader would otherwise read a truncated label ending in an ellipsis.
                  aria-label={item.value}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: isHandoff ? brand.black : 'transparent',
                    color: isHandoff ? brand.white : brand.black,
                    border: '1px solid',
                    borderColor: isHandoff ? brand.black : brand.hairlineStrong,
                    '&:hover': {
                      bgcolor: isHandoff ? brand.black : brand.base,
                    },
                  }}
                />
              </Tooltip>
            )
          })}
        </Stack>
      )}

      <Stack
        direction="row"
        spacing={1}
        sx={{ p: 2.5, pt: cta.length > 0 ? 0.5 : 2.5, alignItems: 'flex-end' }}
      >
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder="Ask about CXone or Cognigy..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit(draft)
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': { bgcolor: brand.gray },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: brand.hairline },
          }}
        />
        <IconButton
          onClick={() => submit(draft)}
          disabled={!draft.trim()}
          aria-label="Send"
          sx={{
            bgcolor: brand.primary,
            color: brand.black,
            width: 40,
            height: 40,
            '&:hover': { bgcolor: brand.primaryDark },
            '&.Mui-disabled': { bgcolor: brand.wash, color: brand.darkGray },
          }}
        >
          <ArrowUpwardRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  )
}
