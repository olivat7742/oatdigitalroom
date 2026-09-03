/**
 * Dev-only preview harness for the DocumentAsset renderer.
 *
 *   http://localhost:5180/verify-document.html
 *
 * Mounts the real component with real catalog data, so the card can be checked without
 * conversing through the agent to reach a document, and without switching the dev server to
 * mock mode. It is a separate Vite entry, so it never ships in the app bundle.
 *
 * Renders three cases deliberately: a case study with an industry badge, a datasheet whose
 * badge set differs, and an asset with no thumbnail, since the fallback icon path is the one
 * most likely to be wrong and the least likely to be seen.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { theme, brand } from '@/theme'
import { toStageAsset } from '@/catalog'
import { DocumentAsset } from '@/components/stage/DocumentAsset'
import type { StageAsset } from '@/types/stageDirective'

const cases: { label: string; asset: StageAsset | null }[] = [
  { label: 'Case study, with industry badge', asset: toStageAsset('optum-case-study') },
  { label: 'Datasheet, technical depth', asset: toStageAsset('cxone-fedramp-for-government') },
  {
    label: 'No thumbnail (fallback icon)',
    asset: (() => {
      const base = toStageAsset('everest-group-global-ccaas-peak-matrix-2026')
      return base ? { ...base, posterUrl: undefined } : null
    })(),
  },
]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Stack spacing={4} sx={{ p: 4, bgcolor: brand.gray, minHeight: '100vh' }}>
        {cases.map(({ label, asset }) => (
          <Stack key={label} spacing={1}>
            <Typography variant="overline" sx={{ color: brand.darkGray }}>
              {label}
            </Typography>
            <Box sx={{ height: 340, bgcolor: brand.white, borderRadius: 3, p: 2.5 }}>
              {asset ? (
                <DocumentAsset asset={asset} />
              ) : (
                <Typography color="error">asset not found in catalog</Typography>
              )}
            </Box>
          </Stack>
        ))}
      </Stack>
    </ThemeProvider>
  </StrictMode>,
)
