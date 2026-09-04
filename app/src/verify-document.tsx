/**
 * Dev-only preview harness for stage renderers.
 *
 *   http://localhost:5180/verify-document.html
 *
 * Mounts real components with real data, so a card or panel can be checked without conversing
 * through the agent to reach it, and without switching the dev server to mock mode. It is a
 * separate Vite entry, so it never ships in the app bundle.
 *
 * Each case is one that is otherwise hard to reach or easy to get wrong: the no-thumbnail
 * fallback, and the three mutually exclusive states of the closing summary's CRM block.
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
import { SummaryPanel } from '@/components/stage/SummaryPanel'
import type { StageAsset, StageSummary } from '@/types/stageDirective'

const documentCases: { label: string; asset: StageAsset | null }[] = [
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

const baseSummary: StageSummary = {
  headline: 'Thanks, Dana.',
  viewed: [{ assetId: 'optum-case-study', title: 'Case Study: Optum' }],
  topics: [{ id: 'ai', label: 'AI agents', preselected: true }],
  emailKnown: true,
}

const summaryCases: { label: string; summary: StageSummary }[] = [
  {
    label: 'CRM: known account, rep named',
    summary: {
      ...baseSummary,
      crm: {
        status: 'known',
        salesRepName: 'Camille Fournier',
        salesRepRole: 'Account Executive',
        accountName: 'Northwind Logistics',
        matchType: 'opportunity',
      },
    },
  },
  {
    label: 'CRM: new lead, an AE will be assigned',
    summary: { ...baseSummary, crm: { status: 'new-lead' } },
  },
  {
    label: 'CRM: absent (NiCE employee, own knowledge) - no block at all',
    summary: baseSummary,
  },
]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Stack spacing={4} sx={{ p: 4, bgcolor: brand.gray, minHeight: '100vh' }}>
        {/* Summary cases first: they are the newest thing here and the three CRM states are
            mutually exclusive, so seeing them adjacent is the whole point. */}
        {summaryCases.map(({ label, summary }) => (
          <Stack key={label} spacing={1}>
            <Typography variant="overline" sx={{ color: brand.darkGray }}>
              {label}
            </Typography>
            <Box sx={{ height: 420, bgcolor: brand.white, borderRadius: 3, p: 2.5 }}>
              <SummaryPanel summary={summary} />
            </Box>
          </Stack>
        ))}

        {documentCases.map(({ label, asset }) => (
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
