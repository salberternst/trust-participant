import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type Defaults = {
  organizationName: string
  requestedBpn: string
  did: string
  dspEndpoint: string
  identityHubCredentialServiceEndpoint: string
  contactEmail: string
  requestedRole: string
}

type OnboardingCase = {
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

type Credential = {
  id: string
  type: string
  issuer: string
  state: string
}

type GatewayState = {
  state: string
  onboarded: boolean
  autoSubmit: boolean
  defaults: Defaults
  caseId?: string
  case?: OnboardingCase
  credentials: Credential[]
  lastError?: string
  updatedAt?: string
  message?: string
}

type PortalLogoSx = {
  height?: number | string
  width?: number | string
}

type PortalThemeMode = {
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
  shape?: { borderRadius?: number }
  spacing?: number
  logo?: { src?: string; alt?: string; sx?: PortalLogoSx }
}

type PortalConfig = {
  title?: string
  theme?: {
    light?: PortalThemeMode
    dark?: PortalThemeMode
  }
}

declare global {
  interface Window {
    config?: PortalConfig
  }
}

const portalConfig = window.config ?? {}
const portalTheme = portalConfig.theme?.light ?? {}
const portalLogo = portalTheme.logo

applyPortalTheme(portalTheme)

function App() {
  const [state, setState] = useState<GatewayState | null>(null)
  const [busy, setBusy] = useState<string>('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'info' | 'error'; text: string } | null>(null)

  useEffect(() => {
    refreshState(false)
    const interval = window.setInterval(() => {
      if (!document.hidden) refreshState(false)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [])

  async function refreshState(showMessage = true) {
    setBusy((current) => current || 'state')
    try {
      const next = await api<GatewayState>('/api/onboarding/state')
      setState(next)
      if (showMessage) setMessage({ tone: next.onboarded ? 'ok' : 'info', text: next.message || 'Status refreshed.' })
      if (next.onboarded) window.setTimeout(() => window.location.assign('/'), 600)
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  async function sendRequest() {
    if (!state) return
    setBusy('case')
    setMessage(null)
    try {
      const next = await api<GatewayState>('/api/onboarding/cases', {
        method: 'POST',
        body: state.defaults,
      })
      setState(next)
      setMessage({ tone: 'ok', text: next.message || 'Onboarding request sent.' })
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  async function retryCredentialSetup() {
    setBusy('credentials')
    setMessage(null)
    try {
      const next = await api<GatewayState>('/api/onboarding/credentials/request', { method: 'POST' })
      setState(next)
      setMessage({ tone: 'ok', text: next.message || 'Credential setup retried.' })
      await refreshState(false)
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  if (!state) {
    return <main className="shell"><div className="panel">Loading onboarding state...</div></main>
  }

  const caseData = state.case
  const isBusy = Boolean(busy)
  const setupSteps = buildSetupSteps(state)
  const details = buildParticipantDetails(state)
  const approved = isApproved(state)
  const canRetryCredentials = Boolean(state.caseId && approved && !state.onboarded && state.lastError)

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brand">
          {portalLogo?.src && (
            <img
              src={portalLogo.src}
              alt={portalLogo.alt || portalConfig.title || 'Portal logo'}
              style={logoStyle(portalLogo.sx)}
            />
          )}
          <span>{portalConfig.title || 'Portal'}</span>
        </div>
        <button type="button" className="button-secondary" onClick={() => refreshState()} disabled={isBusy}>Refresh</button>
      </section>

      <section className="hero">
        <div>
          <p className="eyebrow">Participant access</p>
          <h1>{state.onboarded ? 'Ready for the portal' : 'Setting up portal access'}</h1>
          <p className="lede">{statusDescription(state)}</p>
        </div>
        <StatusBadge state={state} />
      </section>

      {message && <div className={`message ${message.tone}`}>{message.text}</div>}
      {state.lastError && <div className="message error">{state.lastError}</div>}

      <section className="layout">
        <section className="panel request-panel">
          <div className="panel-title">
            <div>
              <h2>Configured participant</h2>
              <p>These values come from the participant deployment configuration and are submitted to the operator.</p>
            </div>
          </div>

          <div className="grid primary-fields">
            <Info label="Organization" value={details.organizationName} />
            <Info label="Contact email" value={details.contactEmail} />
            <Info label="Requested BPN" value={details.requestedBpn} mono />
            <Info label="Requested role" value={details.requestedRole} />
          </div>

          <details className="technical-fields">
            <summary>Technical connection details</summary>
            <div className="grid">
              <Info label="DID" value={details.did} mono />
              <Info label="DSP endpoint" value={details.dspEndpoint} />
              <Info label="Credential service" value={details.identityHubCredentialServiceEndpoint} />
            </div>
          </details>

          <div className="actions">
            {!state.caseId && <button type="button" onClick={sendRequest} disabled={isBusy}>{state.autoSubmit ? 'Retry request' : 'Send request'}</button>}
            {state.caseId && !state.onboarded && <button type="button" onClick={() => refreshState()} disabled={isBusy}>Check now</button>}
            {canRetryCredentials && <button type="button" onClick={retryCredentialSetup} disabled={isBusy}>Retry credential setup</button>}
            <button type="button" className="button-secondary" onClick={() => refreshState()} disabled={isBusy}>Refresh status</button>
          </div>
        </section>

        <aside className="panel progress-panel">
          <div className="panel-title compact">
            <h2>Setup progress</h2>
          </div>
          <div className="steps">
            {setupSteps.map((step) => <StepItem key={step.label} {...step} />)}
          </div>
          <div className="summary-list">
            <Info label="Operator state" value={displayState(caseData?.state || state.state)} />
            <Info label="Assigned BPN" value={caseData?.assignedBpn || caseData?.bpn || 'Pending'} mono />
            <Info label="Updated" value={state.updatedAt ? new Date(state.updatedAt).toLocaleString() : '-'} />
          </div>
        </aside>
      </section>

      <details className="panel technical-panel">
        <summary>Technical details</summary>
        <div className="technical-grid">
          <Info label="Case" value={state.caseId || 'Not created'} mono />
          <Info label="Credential records" value={String(state.credentials.length)} />
        </div>
        <div className="checks">
          {(caseData?.setupChecks || []).map((check) => (
            <div key={check.name} className="check">
              <span>{check.name}</span>
              <strong>{displayState(check.status)}</strong>
              <small>{check.message}</small>
            </div>
          ))}
        </div>
        {state.credentials.length > 0 && (
          <div className="table">
            <div className="row heading"><span>Type</span><span>Issuer</span><span>State</span></div>
            {state.credentials.map((credential) => (
              <div className="row" key={credential.id}>
                <span>{credential.type}</span>
                <span>{credential.issuer || '-'}</span>
                <span>{displayState(credential.state || '-')}</span>
              </div>
            ))}
          </div>
        )}
      </details>
    </main>
  )
}

function Info(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="info">
      <span>{props.label}</span>
      <strong className={props.mono ? 'mono' : ''}>{props.value || '-'}</strong>
    </div>
  )
}

function StatusBadge(props: { state: GatewayState }) {
  const tone = props.state.onboarded ? 'ok' : props.state.caseId ? 'pending' : 'idle'
  return <span className={`status status-${tone}`}>{displayState(props.state.onboarded ? 'ACTIVE' : props.state.state)}</span>
}

function StepItem(props: { label: string; detail: string; state: 'done' | 'active' | 'waiting' }) {
  return (
    <div className={`step step-${props.state}`}>
      <span className="step-marker" aria-hidden="true" />
      <div>
        <strong>{props.label}</strong>
        <p>{props.detail}</p>
      </div>
    </div>
  )
}

function buildParticipantDetails(state: GatewayState) {
  const caseData = state.case ?? {}
  const defaults = state.defaults
  return {
    organizationName: caseData.organizationName || defaults.organizationName,
    requestedBpn: caseData.requestedBpn || defaults.requestedBpn,
    did: caseData.did || defaults.did,
    dspEndpoint: caseData.dspEndpoint || defaults.dspEndpoint,
    identityHubCredentialServiceEndpoint: caseData.identityHubCredentialServiceEndpoint || defaults.identityHubCredentialServiceEndpoint,
    contactEmail: caseData.contactEmail || defaults.contactEmail,
    requestedRole: caseData.requestedRole || defaults.requestedRole,
  }
}

function buildSetupSteps(state: GatewayState) {
  const requestDone = Boolean(state.caseId)
  const approved = isApproved(state)
  const accessDone = state.onboarded

  return [
    {
      label: 'Request sent',
      detail: requestDone
        ? 'The configured participant metadata has been submitted.'
        : state.autoSubmit
          ? 'The gateway is submitting the configured participant metadata.'
          : 'Automatic submission is disabled; send the configured request manually.',
      state: requestDone ? 'done' : 'active',
    },
    {
      label: 'Operator approval',
      detail: approved ? 'The operator has approved the participant request.' : 'Waiting for the operator to review and approve the request.',
      state: approved ? 'done' : requestDone ? 'active' : 'waiting',
    },
    {
      label: 'Credentials and portal access',
      detail: accessDone
        ? 'The expected credentials are available. The portal will open automatically.'
        : approved
          ? 'The gateway is requesting credentials and checking IdentityHub.'
          : 'Credential setup starts automatically after approval.',
      state: accessDone ? 'done' : approved ? 'active' : 'waiting',
    },
  ] as Array<{ label: string; detail: string; state: 'done' | 'active' | 'waiting' }>
}

function isApproved(state: GatewayState) {
  const caseState = state.case?.state || state.state || ''
  return ['READY_FOR_PARTICIPANT', 'CREDENTIALS_REQUESTED', 'ACTIVE', 'ONBOARDED'].includes(caseState) || state.onboarded
}

function statusDescription(state: GatewayState) {
  if (state.onboarded) return 'Your participant has been activated. The gateway will now open the normal portal.'
  if (!state.caseId && !state.autoSubmit) return 'Automatic request submission is disabled. Send the configured request to start onboarding.'
  if (!state.caseId) return 'The gateway is sending the configured participant request to the operator.'
  if (isApproved(state)) return 'The operator has approved the request. The gateway is completing credential setup automatically.'
  return 'Your request is with the operator. This page refreshes regularly and will continue automatically after approval.'
}

function displayState(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || payload.message || `HTTP ${response.status}`)
  return payload as T
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function applyPortalTheme(theme: PortalThemeMode) {
  const root = document.documentElement
  const palette = theme.palette ?? {}
  const primaryMain = palette.primary?.main ?? '#0043ce'
  const primaryDark = palette.primary?.dark ?? primaryMain
  const primaryLight = palette.primary?.light ?? colorMix(primaryMain, '#ffffff', 0.78)
  const textPrimary = palette.text?.primary ?? '#544f5a'
  const textSecondary = palette.text?.secondary ?? '#89868D'
  const paper = palette.background?.paper ?? '#ffffff'
  const background = palette.background?.default ?? '#ffffff'
  const borderRadius = theme.shape?.borderRadius ?? 0
  const spacing = theme.spacing ?? 10

  setCssVars(root, {
    '--portal-primary': primaryMain,
    '--portal-primary-dark': primaryDark,
    '--portal-primary-light': primaryLight,
    '--portal-primary-contrast': palette.primary?.contrastText ?? '#ffffff',
    '--portal-secondary': palette.secondary?.main ?? '#1D49B8',
    '--portal-bg': background,
    '--portal-paper': paper,
    '--portal-text': textPrimary,
    '--portal-muted': textSecondary,
    '--portal-border': colorMix(textSecondary, paper, 0.7),
    '--portal-focus': colorMix(primaryMain, paper, 0.82),
    '--portal-radius': `${borderRadius}px`,
    '--portal-space': `${spacing}px`,
    '--portal-error': palette.error?.main ?? '#E53935',
    '--portal-warning': palette.warning?.main ?? '#FFB74D',
    '--portal-info': palette.info?.main ?? '#29B6F6',
    '--portal-success': palette.success?.main ?? '#66BB6A',
  })
}

function setCssVars(element: HTMLElement, values: Record<string, string>) {
  Object.entries(values).forEach(([name, value]) => element.style.setProperty(name, value))
}

function colorMix(foreground: string, background: string, backgroundWeight: number) {
  const fg = hexToRgb(foreground)
  const bg = hexToRgb(background)
  if (!fg || !bg) return foreground
  const fgWeight = 1 - backgroundWeight
  return `rgb(${Math.round(fg.r * fgWeight + bg.r * backgroundWeight)}, ${Math.round(fg.g * fgWeight + bg.g * backgroundWeight)}, ${Math.round(fg.b * fgWeight + bg.b * backgroundWeight)})`
}

function hexToRgb(color: string) {
  const normalized = color.trim().replace('#', '')
  const hex = normalized.length === 3
    ? normalized.split('').map((value) => value + value).join('')
    : normalized
  if (!/^[\da-f]{6}$/i.test(hex)) return null
  const value = Number.parseInt(hex, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function logoStyle(sx?: PortalLogoSx) {
  if (!sx) return undefined
  return {
    height: toCssSize(sx.height),
    width: toCssSize(sx.width),
  }
}

function toCssSize(value: number | string | undefined) {
  if (typeof value === 'number') return `${value}px`
  return value
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
