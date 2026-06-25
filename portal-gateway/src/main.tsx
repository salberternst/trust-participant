import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
}

type Language = 'en' | 'de'
type ThemeMode = 'light' | 'dark'

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
const storageKeys = {
  locale: 'locale',
  legacyLanguage: 'trust-participant.portal-gateway.language',
  legacyTheme: 'trust-participant.portal-gateway.theme',
  raLocale: 'RaStore.locale',
  raTheme: 'RaStore.theme',
}

const fallbackThemes: Record<ThemeMode, PortalThemeMode> = {
  light: {
    palette: {
      primary: { main: '#0043ce' },
      secondary: { main: '#1D49B8' },
      background: { default: '#ffffff', paper: '#ffffff' },
      text: { primary: '#544f5a', secondary: '#89868D' },
    },
    shape: { borderRadius: 0 },
    spacing: 10,
  },
  dark: {
    palette: {
      primary: { main: '#9055fd' },
      secondary: { main: '#FF83F6' },
      background: { default: '#110e1c', paper: '#151221' },
      text: { primary: '#f3f0ff', secondary: '#c5bdd8' },
      error: { main: '#E53935' },
      warning: { main: '#FFB74D' },
      info: { main: '#29B6F6' },
      success: { main: '#66BB6A' },
    },
    shape: { borderRadius: 0 },
    spacing: 10,
  },
}

const copy = {
  en: {
    active: 'Active',
    assignedBpn: 'Assigned BPN',
    autoSubmissionDisabled: 'Automatic submission is disabled; send the configured request manually.',
    case: 'Case',
    checkNow: 'Check now',
    configuredParticipant: 'Configured participant',
    contactEmail: 'Contact email',
    credentialRecords: 'Credential records',
    credentialService: 'Credential service',
    credentialSetupRetried: 'Credential setup retried.',
    credentialsAndAccess: 'Credentials and portal access',
    credentialsIssued: 'The expected credentials are available. The portal will open automatically.',
    credentialSetupAutomatic: 'Credential setup starts automatically after approval.',
    dark: 'Dark',
    did: 'DID',
    dspEndpoint: 'DSP endpoint',
    issuer: 'Issuer',
    language: 'Language',
    light: 'Light',
    loading: 'Loading onboarding state...',
    noCase: 'Not created',
    onboardingRequestSent: 'Onboarding request sent.',
    operatorApproval: 'Operator approval',
    operatorApproved: 'The operator has approved the participant request.',
    operatorApprovedStatus:
      'The operator has approved the request. The gateway is completing credential setup automatically.',
    operatorState: 'Operator state',
    organization: 'Organization',
    participantAccess: 'Participant access',
    pending: 'Pending',
    portal: 'Portal',
    portalLogo: 'Portal logo',
    portalOpening: 'Participant credentials are issued. Opening portal.',
    preferences: 'Display preferences',
    refresh: 'Refresh',
    refreshStatus: 'Refresh status',
    requestSent: 'Request sent',
    requestedBpn: 'Requested BPN',
    requestedRole: 'Requested role',
    retryCredentialSetup: 'Retry credential setup',
    retryRequest: 'Retry request',
    sendRequest: 'Send request',
    setupProgress: 'Setup progress',
    settingUpAccess: 'Setting up portal access',
    statusRefreshed: 'Status refreshed.',
    submittedMetadata: 'The configured participant metadata has been submitted.',
    submittingMetadata: 'The gateway is submitting the configured participant metadata.',
    technicalConnectionDetails: 'Technical connection details',
    technicalDetails: 'Technical details',
    theme: 'Theme',
    toggleTheme: 'Toggle Theme',
    type: 'Type',
    updated: 'Updated',
    valuesFromConfig:
      'These values come from the participant deployment configuration and are submitted to the operator.',
    waitingForOperator: 'Waiting for the operator to review and approve the request.',
    waitingForOperatorStatus:
      'Your request is with the operator. This page refreshes regularly and will continue automatically after approval.',
    readyForPortal: 'Ready for the portal',
    readyStatus: 'Your participant has been activated. The gateway will now open the normal portal.',
    requestSubmissionDisabledStatus:
      'Automatic request submission is disabled. Send the configured request to start onboarding.',
    requestSubmissionStatus: 'The gateway is sending the configured participant request to the operator.',
    requestingCredentials: 'The gateway is requesting credentials and checking IdentityHub.',
  },
  de: {
    active: 'Aktiv',
    assignedBpn: 'Zugewiesene BPN',
    autoSubmissionDisabled: 'Automatische Übermittlung ist deaktiviert; sende die konfigurierte Anfrage manuell.',
    case: 'Fall',
    checkNow: 'Jetzt prüfen',
    configuredParticipant: 'Konfigurierter Teilnehmer',
    contactEmail: 'Kontakt-E-Mail',
    credentialRecords: 'Credential-Einträge',
    credentialService: 'Credential-Service',
    credentialSetupRetried: 'Credential-Einrichtung erneut gestartet.',
    credentialsAndAccess: 'Credentials und Portalzugang',
    credentialsIssued: 'Die erwarteten Credentials sind verfügbar. Das Portal wird automatisch geöffnet.',
    credentialSetupAutomatic: 'Die Credential-Einrichtung startet automatisch nach der Freigabe.',
    dark: 'Dunkel',
    did: 'DID',
    dspEndpoint: 'DSP-Endpunkt',
    issuer: 'Issuer',
    language: 'Sprache',
    light: 'Hell',
    loading: 'Onboarding-Status wird geladen...',
    noCase: 'Nicht erstellt',
    onboardingRequestSent: 'Onboarding-Anfrage gesendet.',
    operatorApproval: 'Betreiberfreigabe',
    operatorApproved: 'Der Betreiber hat die Teilnehmeranfrage freigegeben.',
    operatorApprovedStatus:
      'Der Betreiber hat die Anfrage freigegeben. Das Gateway schließt die Credential-Einrichtung automatisch ab.',
    operatorState: 'Betreiberstatus',
    organization: 'Organisation',
    participantAccess: 'Teilnehmerzugang',
    pending: 'Ausstehend',
    portal: 'Portal',
    portalLogo: 'Portal-Logo',
    portalOpening: 'Teilnehmer-Credentials wurden ausgestellt. Portal wird geöffnet.',
    preferences: 'Anzeigeeinstellungen',
    refresh: 'Aktualisieren',
    refreshStatus: 'Status aktualisieren',
    requestSent: 'Anfrage gesendet',
    requestedBpn: 'Angefragte BPN',
    requestedRole: 'Angefragte Rolle',
    retryCredentialSetup: 'Credential-Einrichtung wiederholen',
    retryRequest: 'Anfrage erneut senden',
    sendRequest: 'Anfrage senden',
    setupProgress: 'Einrichtungsfortschritt',
    settingUpAccess: 'Portalzugang wird eingerichtet',
    statusRefreshed: 'Status aktualisiert.',
    submittedMetadata: 'Die konfigurierten Teilnehmerdaten wurden übermittelt.',
    submittingMetadata: 'Das Gateway übermittelt die konfigurierten Teilnehmerdaten.',
    technicalConnectionDetails: 'Technische Verbindungsdaten',
    technicalDetails: 'Technische Details',
    theme: 'Theme',
    toggleTheme: 'Theme wechseln',
    type: 'Typ',
    updated: 'Aktualisiert',
    valuesFromConfig: 'Diese Werte stammen aus der Teilnehmerkonfiguration und werden an den Betreiber gesendet.',
    waitingForOperator: 'Warten auf Prüfung und Freigabe durch den Betreiber.',
    waitingForOperatorStatus:
      'Deine Anfrage liegt beim Betreiber. Diese Seite aktualisiert sich regelmäßig und fährt nach der Freigabe automatisch fort.',
    readyForPortal: 'Bereit für das Portal',
    readyStatus: 'Dein Teilnehmer wurde aktiviert. Das Gateway öffnet jetzt das normale Portal.',
    requestSubmissionDisabledStatus:
      'Automatische Anfrageübermittlung ist deaktiviert. Sende die konfigurierte Anfrage, um das Onboarding zu starten.',
    requestSubmissionStatus: 'Das Gateway sendet die konfigurierte Teilnehmeranfrage an den Betreiber.',
    requestingCredentials: 'Das Gateway fordert Credentials an und prüft die lokale IdentityHub.',
  },
} satisfies Record<Language, Record<string, string>>

type UiCopy = typeof copy.en

const localizedStates: Record<Language, Record<string, string>> = {
  en: {
    ACTIVE: 'Active',
    CREDENTIALS_REQUESTED: 'Credentials requested',
    FAILED: 'Failed',
    NOT_STARTED: 'Not started',
    ONBOARDED: 'Onboarded',
    READY_FOR_PARTICIPANT: 'Ready for participant',
    REQUESTED: 'Requested',
  },
  de: {
    ACTIVE: 'Aktiv',
    CREDENTIALS_REQUESTED: 'Credentials angefragt',
    FAILED: 'Fehlgeschlagen',
    NOT_STARTED: 'Nicht gestartet',
    ONBOARDED: 'Onboarded',
    READY_FOR_PARTICIPANT: 'Bereit für Teilnehmer',
    REQUESTED: 'Angefragt',
  },
}

function App() {
  const [state, setState] = useState<GatewayState | null>(null)
  const [busy, setBusy] = useState<string>('')
  const [language, setLanguage] = useState<Language>(() => initialLanguage())
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => initialThemeMode())
  const [message, setMessage] = useState<{ tone: 'ok' | 'info' | 'error'; text: string } | null>(null)
  const t = copy[language]
  const portalTheme = useMemo(() => resolvePortalTheme(themeMode), [themeMode])
  const portalLogo = portalTheme.logo

  useEffect(() => {
    applyPortalTheme(portalTheme)
    document.documentElement.dataset.theme = themeMode
    writeJsonStorage(storageKeys.raTheme, themeMode)
  }, [portalTheme, themeMode])

  useEffect(() => {
    document.documentElement.lang = language
    writeStorage(storageKeys.locale, language)
    writeJsonStorage(storageKeys.raLocale, language)
  }, [language])

  const refreshState = useCallback(
    async (showMessage = true) => {
      setBusy((current) => current || 'state')
      try {
        const next = await api<GatewayState>('/api/onboarding/state')
        setState(next)
        if (showMessage) {
          setMessage({
            tone: next.onboarded ? 'ok' : 'info',
            text: next.onboarded ? t.portalOpening : t.statusRefreshed,
          })
        }
        if (next.onboarded) window.setTimeout(() => window.location.assign('/'), 600)
      } catch (error) {
        setMessage({ tone: 'error', text: getErrorMessage(error) })
      } finally {
        setBusy('')
      }
    },
    [t],
  )

  useEffect(() => {
    refreshState(false)
    const interval = window.setInterval(() => {
      if (!document.hidden) refreshState(false)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [refreshState])

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
      setMessage({ tone: 'ok', text: t.onboardingRequestSent })
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
      setMessage({ tone: 'ok', text: t.credentialSetupRetried })
      await refreshState(false)
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  if (!state) {
    return (
      <main className="shell">
        <div className="panel">{t.loading}</div>
      </main>
    )
  }

  const caseData = state.case
  const isBusy = Boolean(busy)
  const setupSteps = buildSetupSteps(state, t)
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
              alt={portalLogo.alt || portalConfig.title || t.portalLogo}
              style={logoStyle(portalLogo.sx)}
            />
          )}
          <span>{portalConfig.title || t.portal}</span>
        </div>
        <div className="topbar-actions" aria-label={t.preferences}>
          <LocaleMenuButton language={language} onChange={setLanguage} />
          <ThemeToggleButton
            themeMode={themeMode}
            label={t.toggleTheme}
            onToggle={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          />
          <button
            type="button"
            className="appbar-icon-button"
            title={t.refresh}
            aria-label={t.refresh}
            onClick={() => refreshState()}
            disabled={isBusy}
          >
            <RefreshIcon />
          </button>
        </div>
      </section>

      <section className="hero">
        <div>
          <p className="eyebrow">{t.participantAccess}</p>
          <h1>{state.onboarded ? t.readyForPortal : t.settingUpAccess}</h1>
          <p className="lede">{statusDescription(state, t)}</p>
        </div>
        <StatusBadge state={state} language={language} />
      </section>

      {message && <div className={`message ${message.tone}`}>{message.text}</div>}
      {state.lastError && <div className="message error">{state.lastError}</div>}

      <section className="layout">
        <section className="panel request-panel">
          <div className="panel-title">
            <div>
              <h2>{t.configuredParticipant}</h2>
              <p>{t.valuesFromConfig}</p>
            </div>
          </div>

          <div className="grid primary-fields">
            <Info label={t.organization} value={details.organizationName} />
            <Info label={t.contactEmail} value={details.contactEmail} />
            <Info label={t.requestedBpn} value={details.requestedBpn} mono />
            <Info label={t.requestedRole} value={details.requestedRole} />
          </div>

          <details className="technical-fields">
            <summary>{t.technicalConnectionDetails}</summary>
            <div className="grid">
              <Info label={t.did} value={details.did} mono />
              <Info label={t.dspEndpoint} value={details.dspEndpoint} />
              <Info label={t.credentialService} value={details.identityHubCredentialServiceEndpoint} />
            </div>
          </details>

          <div className="actions">
            {!state.caseId && (
              <button type="button" onClick={sendRequest} disabled={isBusy}>
                {state.autoSubmit ? t.retryRequest : t.sendRequest}
              </button>
            )}
            {state.caseId && !state.onboarded && (
              <button type="button" onClick={() => refreshState()} disabled={isBusy}>
                {t.checkNow}
              </button>
            )}
            {canRetryCredentials && (
              <button type="button" onClick={retryCredentialSetup} disabled={isBusy}>
                {t.retryCredentialSetup}
              </button>
            )}
            <button type="button" className="button-secondary" onClick={() => refreshState()} disabled={isBusy}>
              {t.refreshStatus}
            </button>
          </div>
        </section>

        <aside className="panel progress-panel">
          <div className="panel-title compact">
            <h2>{t.setupProgress}</h2>
          </div>
          <div className="steps">
            {setupSteps.map((step) => (
              <StepItem key={step.label} {...step} />
            ))}
          </div>
          <div className="summary-list">
            <Info label={t.operatorState} value={displayState(caseData?.state || state.state, language)} />
            <Info label={t.assignedBpn} value={caseData?.assignedBpn || caseData?.bpn || t.pending} mono />
            <Info label={t.updated} value={formatTimestamp(state.updatedAt, language)} />
          </div>
        </aside>
      </section>

      <details className="panel technical-panel">
        <summary>{t.technicalDetails}</summary>
        <div className="technical-grid">
          <Info label={t.case} value={state.caseId || t.noCase} mono />
          <Info label={t.credentialRecords} value={String(state.credentials.length)} />
        </div>
        <div className="checks">
          {(caseData?.setupChecks || []).map((check) => (
            <div key={check.name} className="check">
              <span>{check.name}</span>
              <strong>{displayState(check.status, language)}</strong>
              <small>{check.message}</small>
            </div>
          ))}
        </div>
        {state.credentials.length > 0 && (
          <div className="table">
            <div className="row heading">
              <span>{t.type}</span>
              <span>{t.issuer}</span>
              <span>{t.operatorState}</span>
            </div>
            {state.credentials.map((credential) => (
              <div className="row" key={credential.id}>
                <span>{credential.type}</span>
                <span>{credential.issuer || '-'}</span>
                <span>{displayState(credential.state || '-', language)}</span>
              </div>
            ))}
          </div>
        )}
      </details>
    </main>
  )
}

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
]

function LocaleMenuButton(props: { language: Language; onChange: (language: Language) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const current = languageOptions.find((option) => option.value === props.language) ?? languageOptions[0]

  useEffect(() => {
    if (!open) return undefined

    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <span className="locale-menu" ref={rootRef}>
      <button
        type="button"
        className="locale-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <TranslateIcon />
        <span>{current.label}</span>
        <ExpandMoreIcon />
      </button>
      {open && (
        <span className="locale-popover" role="menu">
          {languageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === props.language}
              className={option.value === props.language ? 'selected' : ''}
              onClick={() => {
                props.onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

function ThemeToggleButton(props: { themeMode: ThemeMode; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="appbar-icon-button"
      title={props.label}
      aria-label={props.label}
      onClick={props.onToggle}
    >
      {props.themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
    </button>
  )
}

function TranslateIcon() {
  return (
    <svg className="control-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h10" />
      <path d="M9 3v2" />
      <path d="M6 9c1.1 2.2 2.9 3.8 5.4 4.8" />
      <path d="M12 5c-.6 3.4-2.6 6.2-6 8.4" />
      <path d="M13 19l4-9 4 9" />
      <path d="M14.4 16h5.2" />
    </svg>
  )
}

function ExpandMoreIcon() {
  return (
    <svg className="control-icon small" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

function Brightness4Icon() {
  return (
    <svg className="control-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 13.3A7.7 7.7 0 0 1 10.7 3a8.8 8.8 0 1 0 10.3 10.3Z" />
    </svg>
  )
}

function Brightness7Icon() {
  return (
    <svg className="control-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.9 19.1 1.4-1.4" />
      <path d="m17.7 6.3 1.4-1.4" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg className="control-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8.1 8.1 0 0 0-14.2-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 14.2 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </svg>
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

function StatusBadge(props: { state: GatewayState; language: Language }) {
  const tone = props.state.onboarded ? 'ok' : props.state.caseId ? 'pending' : 'idle'
  return (
    <span className={`status status-${tone}`}>
      {displayState(props.state.onboarded ? 'ACTIVE' : props.state.state, props.language)}
    </span>
  )
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
    identityHubCredentialServiceEndpoint:
      caseData.identityHubCredentialServiceEndpoint || defaults.identityHubCredentialServiceEndpoint,
    contactEmail: caseData.contactEmail || defaults.contactEmail,
    requestedRole: caseData.requestedRole || defaults.requestedRole,
  }
}

function buildSetupSteps(state: GatewayState, t: UiCopy) {
  const requestDone = Boolean(state.caseId)
  const approved = isApproved(state)
  const accessDone = state.onboarded

  return [
    {
      label: t.requestSent,
      detail: requestDone ? t.submittedMetadata : state.autoSubmit ? t.submittingMetadata : t.autoSubmissionDisabled,
      state: requestDone ? 'done' : 'active',
    },
    {
      label: t.operatorApproval,
      detail: approved ? t.operatorApproved : t.waitingForOperator,
      state: approved ? 'done' : requestDone ? 'active' : 'waiting',
    },
    {
      label: t.credentialsAndAccess,
      detail: accessDone ? t.credentialsIssued : approved ? t.requestingCredentials : t.credentialSetupAutomatic,
      state: accessDone ? 'done' : approved ? 'active' : 'waiting',
    },
  ] as Array<{ label: string; detail: string; state: 'done' | 'active' | 'waiting' }>
}

function isApproved(state: GatewayState) {
  const caseState = state.case?.state || state.state || ''
  return (
    ['READY_FOR_PARTICIPANT', 'CREDENTIALS_REQUESTED', 'ACTIVE', 'ONBOARDED'].includes(caseState) || state.onboarded
  )
}

function statusDescription(state: GatewayState, t: UiCopy) {
  if (state.onboarded) return t.readyStatus
  if (!state.caseId && !state.autoSubmit) return t.requestSubmissionDisabledStatus
  if (!state.caseId) return t.requestSubmissionStatus
  if (isApproved(state)) return t.operatorApprovedStatus
  return t.waitingForOperatorStatus
}

function displayState(value: string, language: Language) {
  const key = value.toUpperCase()
  return (
    localizedStates[language][key] ??
    value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

function formatTimestamp(value: string | undefined, language: Language) {
  if (!value) return '-'
  return new Date(value).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')
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

function initialLanguage(): Language {
  const stored =
    readJsonStorage(storageKeys.raLocale) ?? readStorage(storageKeys.locale) ?? readStorage(storageKeys.legacyLanguage)
  if (stored === 'en' || stored === 'de') return stored
  return window.navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

function initialThemeMode(): ThemeMode {
  const stored = readJsonStorage(storageKeys.raTheme) ?? readStorage(storageKeys.legacyTheme)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function readJsonStorage(key: string) {
  const value = readStorage(key)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore private-mode and locked-down browser storage failures.
  }
}

function writeJsonStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore private-mode and locked-down browser storage failures.
  }
}

function resolvePortalTheme(mode: ThemeMode) {
  return mergeTheme(fallbackThemes[mode], portalConfig.theme?.[mode])
}

function mergeTheme(base: PortalThemeMode, override: PortalThemeMode = {}): PortalThemeMode {
  return {
    ...base,
    ...override,
    palette: mergePalette(base.palette, override.palette),
    shape: { ...base.shape, ...override.shape },
    logo: override.logo ?? base.logo,
  }
}

function mergePalette(base: PortalThemeMode['palette'], override: PortalThemeMode['palette']) {
  return {
    ...base,
    ...override,
    primary: { ...base?.primary, ...override?.primary },
    secondary: { ...base?.secondary, ...override?.secondary },
    background: { ...base?.background, ...override?.background },
    text: { ...base?.text, ...override?.text },
    error: { ...base?.error, ...override?.error },
    warning: { ...base?.warning, ...override?.warning },
    info: { ...base?.info, ...override?.info },
    success: { ...base?.success, ...override?.success },
  }
}

function applyPortalTheme(theme: PortalThemeMode) {
  const root = document.documentElement
  const palette = theme.palette ?? {}
  const primaryMain = palette.primary?.main ?? '#0043ce'
  const primaryDark = palette.primary?.dark ?? primaryMain
  const primaryLight = palette.primary?.light ?? colorMix(primaryMain, palette.background?.paper ?? '#ffffff', 0.78)
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
    '--portal-error-surface': colorMix(palette.error?.main ?? '#E53935', paper, 0.84),
    '--portal-warning-surface': colorMix(palette.warning?.main ?? '#FFB74D', paper, 0.78),
    '--portal-info-surface': colorMix(palette.info?.main ?? '#29B6F6', paper, 0.86),
    '--portal-success-surface': colorMix(palette.success?.main ?? '#66BB6A', paper, 0.82),
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
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => value + value)
          .join('')
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
