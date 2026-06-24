import React, { FormEvent, useEffect, useMemo, useState } from 'react'
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
  defaults: Defaults
  caseId?: string
  case?: OnboardingCase
  credentials: Credential[]
  lastError?: string
  updatedAt?: string
  message?: string
}

type RequestDraft = Defaults

const emptyDefaults: Defaults = {
  organizationName: '',
  requestedBpn: '',
  did: '',
  dspEndpoint: '',
  identityHubCredentialServiceEndpoint: '',
  contactEmail: '',
  requestedRole: 'participant',
}

function App() {
  const [state, setState] = useState<GatewayState | null>(null)
  const [draft, setDraft] = useState<RequestDraft>(emptyDefaults)
  const [busy, setBusy] = useState<string>('')
  const [message, setMessage] = useState<{ tone: 'ok' | 'info' | 'error'; text: string } | null>(null)

  useEffect(() => {
    refreshState(false)
  }, [])

  async function refreshState(showMessage = true) {
    setBusy((current) => current || 'state')
    try {
      const next = await api<GatewayState>('/api/onboarding/state')
      setState(next)
      setDraft((current) => ({ ...next.defaults, ...current, ...emptyToDefaults(current, next.defaults) }))
      if (showMessage) setMessage({ tone: 'info', text: 'Status refreshed.' })
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  async function submitCase(event: FormEvent) {
    event.preventDefault()
    setBusy('case')
    setMessage(null)
    try {
      const next = await api<GatewayState>('/api/onboarding/cases', {
        method: 'POST',
        body: draft,
      })
      setState(next)
      setMessage({ tone: 'ok', text: next.message || 'Onboarding request created.' })
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  async function requestCredentials() {
    setBusy('credentials')
    setMessage(null)
    try {
      const next = await api<GatewayState>('/api/onboarding/credentials/request', { method: 'POST' })
      setState(next)
      setMessage({ tone: 'ok', text: next.message || 'Credential request submitted.' })
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  async function refreshOnboarding() {
    setBusy('refresh')
    setMessage(null)
    try {
      const next = await api<GatewayState>('/api/onboarding/refresh', { method: 'POST' })
      setState(next)
      setMessage({ tone: next.onboarded ? 'ok' : 'info', text: next.message || 'Onboarding state refreshed.' })
      if (next.onboarded) window.location.assign('/')
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  const canRequestCredentials = useMemo(() => {
    const caseState = state?.case?.state || state?.state || ''
    return Boolean(state?.caseId && ['READY_FOR_PARTICIPANT', 'CREDENTIALS_REQUESTED', 'ACTIVE'].includes(caseState))
  }, [state])

  if (!state) {
    return <main className="shell"><div className="panel">Loading onboarding state...</div></main>
  }

  const caseData = state.case
  const isBusy = Boolean(busy)

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">Trust Participant</p>
          <h1>Onboarding</h1>
        </div>
        <span className={`status status-${state.onboarded ? 'ok' : 'pending'}`}>{state.state}</span>
      </section>

      {message && <div className={`message ${message.tone}`}>{message.text}</div>}
      {state.lastError && <div className="message error">{state.lastError}</div>}

      <section className="layout">
        <form className="panel" onSubmit={submitCase}>
          <div className="panel-title">
            <h2>Participant request</h2>
            <button type="button" onClick={() => refreshState()} disabled={isBusy}>Refresh</button>
          </div>
          <div className="grid">
            <Field label="Organization" value={draft.organizationName} onChange={(value) => updateDraft('organizationName', value)} required />
            <Field label="Requested BPN" value={draft.requestedBpn} onChange={(value) => updateDraft('requestedBpn', value)} />
            <Field label="DID" value={draft.did} onChange={(value) => updateDraft('did', value)} />
            <Field label="DSP endpoint" value={draft.dspEndpoint} onChange={(value) => updateDraft('dspEndpoint', value)} />
            <Field label="Credential service" value={draft.identityHubCredentialServiceEndpoint} onChange={(value) => updateDraft('identityHubCredentialServiceEndpoint', value)} />
            <Field label="Contact email" type="email" value={draft.contactEmail} onChange={(value) => updateDraft('contactEmail', value)} required />
            <Field label="Requested role" value={draft.requestedRole} onChange={(value) => updateDraft('requestedRole', value)} required />
          </div>
          <div className="actions">
            <button type="submit" disabled={isBusy || state.onboarded}>{state.caseId ? 'Replace request' : 'Create request'}</button>
            <button type="button" onClick={requestCredentials} disabled={isBusy || !canRequestCredentials || state.onboarded}>Request credentials</button>
            <button type="button" onClick={refreshOnboarding} disabled={isBusy || !state.caseId || state.onboarded}>Poll credentials</button>
          </div>
        </form>

        <aside className="panel summary">
          <h2>Status</h2>
          <Info label="Case" value={state.caseId || 'Not created'} mono />
          <Info label="Operator state" value={caseData?.state || '-'} />
          <Info label="Assigned BPN" value={caseData?.assignedBpn || caseData?.bpn || '-'} mono />
          <Info label="Updated" value={state.updatedAt ? new Date(state.updatedAt).toLocaleString() : '-'} />
          <div className="checks">
            {(caseData?.setupChecks || []).map((check) => (
              <div key={check.name} className="check">
                <span>{check.name}</span>
                <strong>{check.status}</strong>
                <small>{check.message}</small>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel credentials">
        <div className="panel-title">
          <h2>IdentityHub credentials</h2>
          <span>{state.credentials.length}</span>
        </div>
        <div className="table">
          <div className="row heading"><span>Type</span><span>Issuer</span><span>State</span></div>
          {state.credentials.map((credential) => (
            <div className="row" key={credential.id}>
              <span>{credential.type}</span>
              <span>{credential.issuer || '-'}</span>
              <span>{credential.state || '-'}</span>
            </div>
          ))}
          {!state.credentials.length && <div className="empty">No credentials observed yet.</div>}
        </div>
      </section>
    </main>
  )

  function updateDraft(field: keyof RequestDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
  }
}

function Field(props: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input type={props.type || 'text'} value={props.value} onChange={(event) => props.onChange(event.target.value)} required={props.required} />
    </label>
  )
}

function Info(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="info">
      <span>{props.label}</span>
      <strong className={props.mono ? 'mono' : ''}>{props.value}</strong>
    </div>
  )
}

function emptyToDefaults(current: RequestDraft, defaults: Defaults) {
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [key, value || defaults[key as keyof Defaults] || '']),
  ) as RequestDraft
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

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
