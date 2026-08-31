import { createTheme } from '@mui/material/styles'

/**
 * NiCE brand tokens, read from the live CSS custom properties on nice.com rather than
 * guessed at. Source of truth for the values below:
 *
 *   --black #22212b   --primary #3694fd   --darkblue #2c79ee   --darkgray #6d6d72
 *   --gray  #f2f0eb   --darkbase #e8e6e0  --red     #ff5b8a    --darkred  #e73b71
 *   --green #00e2a0
 *
 * Typeface is Be Vietnam Pro. nice.com runs body text at weight 300 and headings at 500
 * with negative tracking, which is most of what makes the brand recognisable.
 *
 * Buttons on nice.com are full pills (38px radius) in either primary blue with near-black
 * text, or near-black with white text. Both patterns are reproduced here.
 */
export const brand = {
  black: '#22212b',
  ink: '#11181c',
  primary: '#3694fd',
  primaryDark: '#2c79ee',
  darkGray: '#6d6d72',
  gray: '#f2f0eb',
  base: '#e8e6e0',
  pink: '#ff5b8a',
  pinkDark: '#e73b71',
  mint: '#00e2a0',
  white: '#ffffff',
  /** Stage surround. NiCE's own black, so a dark video surface stays on brand. */
  stage: '#22212b',
  hairline: 'rgba(34, 33, 43, 0.12)',
  hairlineStrong: 'rgba(34, 33, 43, 0.22)',
  wash: 'rgba(34, 33, 43, 0.05)',
} as const

export const FONT_STACK =
  "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.primary, dark: brand.primaryDark, contrastText: brand.black },
    secondary: { main: brand.pink, dark: brand.pinkDark, contrastText: brand.black },
    success: { main: brand.mint, contrastText: brand.black },
    background: { default: brand.gray, paper: brand.white },
    text: { primary: brand.black, secondary: brand.darkGray },
    divider: brand.hairline,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: FONT_STACK,
    // nice.com sets body copy light. It reads as considered rather than thin at 15 to 16px.
    fontWeightRegular: 300,
    fontWeightMedium: 500,
    h5: { fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.2 },
    h6: { fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 },
    subtitle2: { fontWeight: 500, letterSpacing: '-0.01em' },
    body1: { fontWeight: 300, lineHeight: 1.6 },
    body2: { fontWeight: 300, lineHeight: 1.6 },
    button: { fontWeight: 400, letterSpacing: 0 },
    caption: { fontWeight: 400 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 999, paddingInline: 18 },
        containedPrimary: { color: brand.black },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 400 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 22, backgroundColor: brand.white } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, backgroundColor: brand.hairline },
        bar: { borderRadius: 999 },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
})
