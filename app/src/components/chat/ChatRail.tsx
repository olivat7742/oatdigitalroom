import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
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
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, agentTyping, cta])

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
      <Stack spacing={1.75} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', p: 2.5 }}>
        {messages.length === 0 && connection !== 'open' && (
          <Typography variant="body2" sx={{ color: brand.darkGray }}>
            Connecting to the guide...
          </Typography>
        )}

        {messages.map((item) => (
          <MessageBubble key={item.id} message={item} />
        ))}

        {agentTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </Stack>

      {cta.length > 0 && (
        <Stack
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
          }}
        >
          {cta.map((item, index) => {
            const isHandoff = item.kind === 'handoff'
            return (
              <Chip
                key={`${item.value}-${index}`}
                label={item.label}
                onClick={() => submit(item.value)}
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
