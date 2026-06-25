import type { Language } from './types'

export const copy = {
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
    did: 'DID',
    dspEndpoint: 'DSP endpoint',
    issuer: 'Issuer',
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
    did: 'DID',
    dspEndpoint: 'DSP-Endpunkt',
    issuer: 'Issuer',
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

export type UiCopy = typeof copy.en

export const languageOptions: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
]

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

export function displayState(value: string, language: Language) {
  const key = value.toUpperCase()
  return (
    localizedStates[language][key] ??
    value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

export function formatTimestamp(value: string | undefined, language: Language) {
  if (!value) return '-'
  return new Date(value).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')
}
