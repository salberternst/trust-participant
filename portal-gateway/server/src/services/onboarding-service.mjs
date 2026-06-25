import { config, onboardingDefaults } from '../config/index.mjs'
import { dataspaceFetch } from '../clients/dataspace-admin-client.mjs'
import { assertIdentityHubConfigured, getIdentityHubParticipantContextPathId, identityHubFetch } from '../clients/identityhub-client.mjs'
import { ensureDb, loadStateRow, patchState, requireStateRow, upsertState } from '../db/state-repository.mjs'
import { httpError } from '../lib/http-errors.mjs'
import { isRecord } from '../lib/objects.mjs'
import { extractCredentials, normalizeCaseData, normalizeOnboardingInput } from '../lib/onboarding-normalizers.mjs'

const participantReadyStates = ['READY_FOR_PARTICIPANT', 'CREDENTIALS_REQUESTED', 'ACTIVE']
let autoProgressPromise = null

export async function createOnboardingCase(body = {}) {
  const payload = normalizeOnboardingInput(body)
  const created = await dataspaceFetch('/onboarding-cases', { method: 'POST', body: payload })
  const caseData = isRecord(created.case) ? created.case : {}
  const caseId = String(created.caseId ?? caseData.id ?? '')
  const participantToken = String(created.participantToken ?? '')
  if (!caseId || !participantToken) {
    throw httpError(502, 'dataspace-admin did not return a case id and participant token', created)
  }

  await upsertState({
    state: String(caseData.state ?? 'REQUESTED'),
    caseId,
    participantToken,
    caseData,
    credentialRequest: {},
    credentials: [],
    lastError: '',
    input: payload,
  })

  return {
    ...(await buildStateResponse()),
    message: 'Onboarding request created.',
  }
}

export async function requestCredentials() {
  const row = await requireStateRow()
  return requestCredentialsForRow(row)
}

export async function refreshOnboarding() {
  const row = await requireStateRow()
  return refreshOnboardingForRow(row)
}

export async function buildStateResponse(options = {}) {
  if (options.autoProgress) await autoProgressOnboarding()
  return buildRawStateResponse()
}

export async function isOnboarded() {
  await ensureDb()
  const row = await loadStateRow()
  return row?.state === 'ONBOARDED'
}

async function autoProgressOnboarding() {
  if (autoProgressPromise) return autoProgressPromise
  autoProgressPromise = runAutoProgress().finally(() => {
    autoProgressPromise = null
  })
  return autoProgressPromise
}

async function runAutoProgress() {
  await ensureDb()
  let row = await loadStateRow()

  if (!row && config.onboardingAutoSubmit) {
    try {
      await createOnboardingCase(onboardingDefaults())
    } catch (error) {
      await recordSubmissionFailure(error)
      return
    }
    row = await loadStateRow()
  }

  if (!row || !row.case_id || row.state === 'ONBOARDED') return

  const refreshed = await refreshOnboardingForRow(row, { returnRaw: true })
  row = await loadStateRow()
  const caseState = String(refreshed.case?.state ?? row?.state ?? '')

  if (!row || row.state === 'ONBOARDED') return
  if (!participantReadyStates.includes(caseState)) return

  const credentialRequestKnown = hasCredentialRequest(row.credential_request)
  if (!credentialRequestKnown || row.state !== 'CREDENTIALS_REQUESTED') {
    try {
      await requestCredentialsForRow(row, { returnRaw: true })
    } catch {
      return
    }
    row = await loadStateRow()
  }

  if (row && row.state !== 'ONBOARDED') {
    await refreshOnboardingForRow(row, { returnRaw: true })
  }
}

async function requestCredentialsForRow(row, options = {}) {
  assertParticipantCase(row)
  await assertIdentityHubConfigured()

  const credentialRequest = await dataspaceFetch(`/onboarding-cases/${encodeURIComponent(row.case_id)}/credential-request`, {
    token: row.participant_token,
  })

  try {
    await identityHubFetch(
      `/v1alpha/participants/${encodeURIComponent(getIdentityHubParticipantContextPathId())}/credentials/request`,
      { method: 'POST', body: credentialRequest },
    )

    const receiptWarning = await reportReceipt(row.case_id, row.participant_token, {
      status: 'requested',
      message: 'Credential request submitted by participant portal gateway.',
      credentials: credentialRequest.credentials ?? [],
    })
    const caseData = await fetchCase(row)

    await patchState({
      state: 'CREDENTIALS_REQUESTED',
      caseData,
      credentialRequest,
      lastError: receiptWarning,
    })

    const response = await buildRawStateResponse()
    return {
      ...response,
      message: receiptWarning
        ? `Credential request submitted; receipt report failed: ${receiptWarning}`
        : 'Credential request submitted to IdentityHub.',
    }
  } catch (error) {
    await reportReceipt(row.case_id, row.participant_token, {
      status: 'failed',
      message: error.message ?? 'IdentityHub credential request failed',
      credentials: credentialRequest.credentials ?? [],
    }).catch(() => undefined)
    await patchState({ state: 'FAILED', credentialRequest, lastError: error.message ?? 'Credential request failed' })
    if (options.returnRaw) return buildRawStateResponse()
    throw error
  }
}

async function refreshOnboardingForRow(row, options = {}) {
  assertParticipantCase(row)

  let caseData = row.case_data ?? {}
  let credentialRequest = row.credential_request ?? {}
  let credentials = Array.isArray(row.credentials) ? row.credentials : []
  let lastError = ''
  let issued = false
  let receiptWarning = ''

  try {
    caseData = await fetchCase(row)
  } catch (error) {
    lastError = error.message ?? 'Could not refresh onboarding case'
  }

  const caseState = String(caseData.state ?? row.state ?? '')
  if (participantReadyStates.includes(caseState) && hasCredentialRequest(credentialRequest)) {
    try {
      await assertIdentityHubConfigured()
      credentialRequest = await dataspaceFetch(`/onboarding-cases/${encodeURIComponent(row.case_id)}/credential-request`, {
        token: row.participant_token,
      })
      const identityHubResponse = await identityHubFetch(
        `/v1alpha/participants/${encodeURIComponent(getIdentityHubParticipantContextPathId())}/credentials`,
      )
      credentials = extractCredentials(identityHubResponse)
      const expected = Array.isArray(credentialRequest.credentials) ? credentialRequest.credentials : []
      issued =
        expected.length > 0 &&
        expected.every((item) => credentials.some((credential) => credential.type === item.type || credential.id === item.id))

      receiptWarning = await reportReceipt(row.case_id, row.participant_token, {
        status: issued ? 'issued' : 'requested',
        message: issued ? 'Expected credentials found in IdentityHub.' : 'IdentityHub credentials were polled.',
        credentials,
      })
    } catch (error) {
      lastError = error.message ?? 'Could not poll IdentityHub credentials'
    }
  }

  const nextState = issued && !receiptWarning ? 'ONBOARDED' : caseState || row.state || 'REQUESTED'
  await patchState({
    state: nextState,
    caseData,
    credentialRequest,
    credentials,
    lastError: receiptWarning || lastError,
  })

  const response = await buildRawStateResponse()
  return {
    ...response,
    message: issued && !receiptWarning ? 'Participant credentials are issued. Opening portal.' : 'Onboarding state refreshed.',
  }
}

async function buildRawStateResponse() {
  const row = await loadStateRow()
  const defaults = onboardingDefaults()
  if (!row) {
    return {
      state: 'NOT_STARTED',
      onboarded: false,
      autoSubmit: config.onboardingAutoSubmit,
      defaults,
      credentials: [],
    }
  }

  return {
    state: row.state,
    onboarded: row.state === 'ONBOARDED',
    autoSubmit: config.onboardingAutoSubmit,
    defaults,
    caseId: row.case_id || undefined,
    case: normalizeCaseData(row.case_data),
    credentials: Array.isArray(row.credentials) ? row.credentials : [],
    credentialRequest: row.credential_request ?? {},
    lastError: row.last_error || undefined,
    updatedAt: row.updated_at,
  }
}

async function recordSubmissionFailure(error) {
  const payload = normalizeOnboardingInput(onboardingDefaults())
  await upsertState({
    state: 'FAILED',
    caseId: '',
    participantToken: '',
    caseData: {},
    credentialRequest: {},
    credentials: [],
    lastError: error.message ?? 'Onboarding request could not be submitted',
    input: payload,
  })
}

async function fetchCase(row) {
  return dataspaceFetch(`/onboarding-cases/${encodeURIComponent(row.case_id)}`, { token: row.participant_token })
}

async function reportReceipt(caseId, token, body) {
  try {
    await dataspaceFetch(`/onboarding-cases/${encodeURIComponent(caseId)}/credential-receipts`, {
      method: 'POST',
      token,
      body,
    })
    return ''
  } catch (error) {
    return error.message ?? 'unknown error'
  }
}

function assertParticipantCase(row) {
  if (!row.case_id || !row.participant_token) {
    throw httpError(409, 'Onboarding case is missing local participant credentials')
  }
}

function hasCredentialRequest(value) {
  return isRecord(value) && Array.isArray(value.credentials) && value.credentials.length > 0
}
