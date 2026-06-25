import type { ThemeOptions } from '@mui/material/styles'

export type Defaults = {
  organizationName: string
  requestedBpn: string
  did: string
  dspEndpoint: string
  identityHubCredentialServiceEndpoint: string
  contactEmail: string
  requestedRole: string
}

export type OnboardingCase = {
  id?: string
  organizationName?: string
  requestedBpn?: string
  assignedBpn?: string
  bpn?: string
  did?: string
  dspEndpoint?: string
  identityHubCredentialServiceEndpoint?: string
  contactEmail?: string
  requestedRole?: string
  state?: string
  setupChecks?: Array<{ name: string; status: string; message: string }>
}

export type Credential = {
  id: string
  type: string
  issuer: string
  state: string
}

export type GatewayState = {
  state: string
  onboarded: boolean
  autoSubmit: boolean
  defaults: Defaults
  caseId?: string
  case?: OnboardingCase
  credentials: Credential[]
  lastError?: string
  updatedAt?: string
}

export type Language = 'en' | 'de'
export type ThemeMode = 'light' | 'dark'

export type PortalLogoSx = {
  height?: number | string
  width?: number | string
}

export type PortalThemeMode = {
  palette?: {
    primary?: { main?: string; light?: string; dark?: string; contrastText?: string }
    secondary?: { main?: string }
    background?: { default?: string; paper?: string }
    text?: { primary?: string; secondary?: string }
    error?: { main?: string }
    warning?: { main?: string }
    info?: { main?: string }
    success?: { main?: string }
  }
  typography?: ThemeOptions['typography']
  shape?: { borderRadius?: number }
  spacing?: number
  sidebarWidth?: number
  logo?: { src?: string; alt?: string; sx?: PortalLogoSx }
}

export type PortalConfig = {
  title?: string
  theme?: {
    light?: PortalThemeMode
    dark?: PortalThemeMode
  }
}

export type ParticipantDetails = Defaults
export type SetupStepState = 'done' | 'active' | 'waiting'
export type SetupStep = { label: string; detail: string; state: SetupStepState }
