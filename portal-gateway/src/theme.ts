import { alpha, createTheme, type PaletteOptions, type ThemeOptions } from '@mui/material/styles'
import { portalConfig } from './config'
import type { PortalLogoSx, PortalThemeMode, ThemeMode } from './types'

const alertPalette = {
  error: { main: '#E53935' },
  warning: { main: '#FFB74D' },
  info: { main: '#29B6F6' },
  success: { main: '#66BB6A' },
}

const fallbackPalettes: Record<ThemeMode, PaletteOptions> = {
  light: {
    primary: { main: '#0043ce' },
    secondary: { main: '#1D49B8' },
    background: { default: '#ffffff', paper: '#ffffff' },
    text: { primary: '#544f5a', secondary: '#89868D' },
    ...alertPalette,
    mode: 'light',
  },
  dark: {
    primary: { main: '#9055fd' },
    secondary: { main: '#FF83F6' },
    background: { default: '#110e1c', paper: '#151221' },
    text: { primary: '#f3f0ff', secondary: '#c5bdd8' },
    ...alertPalette,
    mode: 'dark',
  },
}

const baseTypography: ThemeOptions['typography'] = {
  h1: { fontWeight: 500, fontSize: '6rem' },
  h2: { fontWeight: 600 },
  h3: { fontWeight: 700 },
  h4: { fontWeight: 800 },
  h5: { fontWeight: 900 },
  button: { textTransform: 'none', fontWeight: 700 },
}

export function createGatewayTheme(mode: ThemeMode) {
  const overrides = portalConfig.theme?.[mode] ?? {}
  const palette = mergePalette(fallbackPalettes[mode], overrides.palette)
  palette.mode = mode

  const theme = createTheme({
    palette,
    spacing: overrides.spacing ?? 10,
    shape: { borderRadius: 0, ...overrides.shape },
    typography: mergeObjects(baseTypography, overrides.typography),
  })

  theme.components = {
    MuiAppBar: {
      styleOverrides: {
        colorSecondary: {
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
        },
      },
    },
    MuiButton: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        sizeSmall: {
          padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        elevation1: {
          boxShadow: `${alpha(theme.palette.primary.main, 0.2)} -2px 2px, ${alpha(
            theme.palette.primary.main,
            0.1,
          )} -4px 4px, ${alpha(theme.palette.primary.main, 0.05)} -6px 6px`,
        },
        root: {
          backgroundClip: 'padding-box',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: theme.spacing(1.5) },
        sizeSmall: { padding: theme.spacing(1) },
      },
    },
  }

  return {
    theme,
    logo: overrides.logo ?? portalConfig.theme?.light?.logo,
  }
}

export function logoStyle(sx?: PortalLogoSx) {
  if (!sx) return undefined
  return {
    height: toCssSize(sx.height),
    width: toCssSize(sx.width),
  }
}

function mergePalette(base: PaletteOptions, override: PortalThemeMode['palette']): PaletteOptions {
  const merged = {
    ...base,
    ...override,
    primary: { ...base.primary, ...override?.primary },
    secondary: { ...base.secondary, ...override?.secondary },
    background: { ...base.background, ...override?.background },
    text: { ...base.text, ...override?.text },
    error: { ...base.error, ...override?.error },
    warning: { ...base.warning, ...override?.warning },
    info: { ...base.info, ...override?.info },
    success: { ...base.success, ...override?.success },
  }
  return merged as PaletteOptions
}

function mergeObjects<T>(base: T, override: T | undefined): T {
  if (!override || typeof override !== 'object') return base
  return { ...base, ...override }
}

function toCssSize(value: number | string | undefined) {
  if (typeof value === 'number') return `${value}px`
  return value
}
