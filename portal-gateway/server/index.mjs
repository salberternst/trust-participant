import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const port = Number(process.env.PORT ?? 3000)
const databaseUrl = process.env.DATABASE_URL ?? buildDatabaseUrl()
const portalUpstreamUrl = trimTrailingSlash(process.env.PORTAL_UPSTREAM_URL ?? 'http://portal:80')
const dataspaceAdminApiUrl = trimTrailingSlash(
  process.env.ONBOARDING_DATASPACE_ADMIN_API_URL ?? process.env.DATASPACE_ADMIN_API_URL ?? 'http://dataspace-admin:3000/api',
)
const identityHubIdentityApiUrl = trimTrailingSlash(process.env.IDENTITYHUB_IDENTITY_API_URL ?? 'http://identityhub:8082/api/identity')
const identityHubParticipantContextId = process.env.IDENTITYHUB_PARTICIPANT_CONTEXT_ID ?? process.env.PARTICIPANT_BPN ?? ''
const identityHubParticipantContextPathId = process.env.IDENTITYHUB_PARTICIPANT_CONTEXT_PATH_ID ?? ''
const identityHubApiKey = process.env.IDENTITYHUB_API_KEY ?? ''
const identityHubVaultUrl = trimTrailingSlash(process.env.IDENTITYHUB_VAULT_URL ?? '')
const identityHubVaultToken = process.env.IDENTITYHUB_VAULT_TOKEN ?? ''
const identityHubApiKeyVaultPath = process.env.IDENTITYHUB_API_KEY_VAULT_PATH ?? '/v1/secret/data/super-user-apikey'
const staticDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const stateId = 'default'

let cachedIdentityHubApiKey = ''
let dbReady = null
const pool = new Pool({ connectionString: databaseUrl })

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

    if (request.method === 'GET' && url.pathname === '/health') {
      await ensureDb()
      sendJson(response, 200, { status: 'ok' })
      return
    }

    if (url.pathname.startsWith('/api/onboarding')) {
      await handleOnboardingApi(request, response, url)
      return
    }

    if (await isOnboarded()) {
      await proxyToPortal(request, response, url)
      return
    }

    await serveOnboardingApp(response, url)
  } catch (error) {
    const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : 500
    if (status >= 500) console.error(error)
    sendJson(response, status, {
      error: error.message ?? 'Internal server error',
      details: error.details,
    })
  }
})

server.listen(port, () => {
  console.log(`participant portal gateway listening on ${port}`)
})

async function handleOnboardingApi(request, response, url) {
  await ensureDb()

  if (request.method === 'GET' && url.pathname === '/api/onboarding/state') {
    sendJson(response, 200, await buildStateResponse())
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/onboarding/cases') {
    const body = await readJson(request)
    sendJson(response, 201, await createOnboardingCase(body))
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/onboarding/credentials/request') {
    sendJson(response, 200, await requestCredentials())
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/onboarding/refresh') {
    sendJson(response, 200, await refreshOnboarding())
    return
  }

  sendJson(response, 404, { error: 'Not found' })
}

async function ensureDb() {
  if (!dbReady) {
    dbReady = pool.query(`
      CREATE TABLE IF NOT EXISTS onboarding_state (
        id text PRIMARY KEY,
        state text NOT NULL,
        case_id text,
        participant_token text,
        organization_name text,
        requested_bpn text,
        assigned_bpn text,
        did text,
        dsp_endpoint text,
        identityhub_credential_service_endpoint text,
        contact_email text,
        requested_role text,
        case_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        credential_request jsonb NOT NULL DEFAULT '{}'::jsonb,
        credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
  }
  await dbReady
}

async function createOnboardingCase(body) {
  const payload = normalizeOnboardingInput(body)
  const created = await dataspaceFetch('/onboarding-cases', { method: 'POST', body: payload })
  const caseData = isRecord(created.case) ? created.case : {}
  const caseId = String(created.caseId ?? caseData.id ?? '')
  const participantToken = String(created.participantToken ?? '')
  if (!caseId || !participantToken) {
    const error = new Error('dataspace-admin did not return a case id and participant token')
    error.status = 502
    error.details = created
    throw error
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

async function requestCredentials() {
  const row = await requireStateRow()
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

    return {
      ...(await buildStateResponse()),
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
    throw error
  }
}

async function refreshOnboarding() {
  const row = await requireStateRow()
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
  if (['READY_FOR_PARTICIPANT', 'CREDENTIALS_REQUESTED', 'ACTIVE'].includes(caseState)) {
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

  return {
    ...(await buildStateResponse()),
    message: issued && !receiptWarning ? 'Participant credentials are issued. Opening portal.' : 'Onboarding state refreshed.',
  }
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

async function buildStateResponse() {
  const row = await loadStateRow()
  const defaults = onboardingDefaults()
  if (!row) {
    return {
      state: 'NOT_STARTED',
      onboarded: false,
      defaults,
      credentials: [],
    }
  }

  return {
    state: row.state,
    onboarded: row.state === 'ONBOARDED',
    defaults,
    caseId: row.case_id || undefined,
    case: normalizeCaseData(row.case_data),
    credentials: Array.isArray(row.credentials) ? row.credentials : [],
    credentialRequest: row.credential_request ?? {},
    lastError: row.last_error || undefined,
    updatedAt: row.updated_at,
  }
}

async function isOnboarded() {
  await ensureDb()
  const row = await loadStateRow()
  return row?.state === 'ONBOARDED'
}

async function loadStateRow() {
  const { rows } = await pool.query('SELECT * FROM onboarding_state WHERE id=$1', [stateId])
  return rows[0] ?? null
}

async function requireStateRow() {
  const row = await loadStateRow()
  if (!row) {
    const error = new Error('No onboarding case has been created yet')
    error.status = 409
    throw error
  }
  return row
}

function assertParticipantCase(row) {
  if (!row.case_id || !row.participant_token) {
    const error = new Error('Onboarding case is missing local participant credentials')
    error.status = 409
    throw error
  }
}

async function upsertState({ state, caseId, participantToken, caseData, credentialRequest, credentials, lastError, input }) {
  const normalizedCase = normalizeCaseData(caseData)
  await pool.query(
    `INSERT INTO onboarding_state (
       id, state, case_id, participant_token, organization_name, requested_bpn, assigned_bpn,
       did, dsp_endpoint, identityhub_credential_service_endpoint, contact_email, requested_role,
       case_data, credential_request, credentials, last_error, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,now())
     ON CONFLICT (id) DO UPDATE SET
       state=EXCLUDED.state,
       case_id=EXCLUDED.case_id,
       participant_token=EXCLUDED.participant_token,
       organization_name=EXCLUDED.organization_name,
       requested_bpn=EXCLUDED.requested_bpn,
       assigned_bpn=EXCLUDED.assigned_bpn,
       did=EXCLUDED.did,
       dsp_endpoint=EXCLUDED.dsp_endpoint,
       identityhub_credential_service_endpoint=EXCLUDED.identityhub_credential_service_endpoint,
       contact_email=EXCLUDED.contact_email,
       requested_role=EXCLUDED.requested_role,
       case_data=EXCLUDED.case_data,
       credential_request=EXCLUDED.credential_request,
       credentials=EXCLUDED.credentials,
       last_error=EXCLUDED.last_error,
       updated_at=now()`,
    [
      stateId,
      state,
      caseId,
      participantToken,
      input.organizationName,
      normalizedCase.requestedBpn || input.requestedBpn,
      normalizedCase.assignedBpn || '',
      input.did,
      input.dspEndpoint,
      input.identityHubCredentialServiceEndpoint,
      input.contactEmail,
      input.requestedRole,
      JSON.stringify(caseData ?? {}),
      JSON.stringify(credentialRequest ?? {}),
      JSON.stringify(credentials ?? []),
      lastError || null,
    ],
  )
}

async function patchState({ state, caseData, credentialRequest, credentials, lastError }) {
  const normalizedCase = normalizeCaseData(caseData ?? {})
  await pool.query(
    `UPDATE onboarding_state SET
       state=COALESCE($2, state),
       case_data=COALESCE($3::jsonb, case_data),
       credential_request=COALESCE($4::jsonb, credential_request),
       credentials=COALESCE($5::jsonb, credentials),
       assigned_bpn=COALESCE(NULLIF($6, ''), assigned_bpn),
       last_error=$7,
       updated_at=now()
     WHERE id=$1`,
    [
      stateId,
      state || null,
      caseData === undefined ? null : JSON.stringify(caseData ?? {}),
      credentialRequest === undefined ? null : JSON.stringify(credentialRequest ?? {}),
      credentials === undefined ? null : JSON.stringify(credentials ?? []),
      normalizedCase.assignedBpn || normalizedCase.bpn || '',
      lastError || null,
    ],
  )
}

function normalizeOnboardingInput(body) {
  const defaults = onboardingDefaults()
  return {
    organizationName: text(body.organizationName, defaults.organizationName),
    requestedBpn: text(body.requestedBpn ?? body.bpn, defaults.requestedBpn),
    did: text(body.did, defaults.did),
    dspEndpoint: text(body.dspEndpoint, defaults.dspEndpoint),
    identityHubCredentialServiceEndpoint: text(
      body.identityHubCredentialServiceEndpoint,
      defaults.identityHubCredentialServiceEndpoint,
    ),
    contactEmail: text(body.contactEmail, defaults.contactEmail),
    requestedRole: text(body.requestedRole, defaults.requestedRole || 'participant'),
  }
}

function onboardingDefaults() {
  return {
    organizationName: process.env.ONBOARDING_ORGANIZATION_NAME ?? '',
    requestedBpn: process.env.ONBOARDING_REQUESTED_BPN ?? process.env.PARTICIPANT_BPN ?? '',
    did: process.env.ONBOARDING_DID ?? '',
    dspEndpoint: process.env.ONBOARDING_DSP_ENDPOINT ?? '',
    identityHubCredentialServiceEndpoint: process.env.ONBOARDING_CREDENTIAL_SERVICE_ENDPOINT ?? '',
    contactEmail: process.env.ONBOARDING_CONTACT_EMAIL ?? '',
    requestedRole: process.env.ONBOARDING_REQUESTED_ROLE ?? 'participant',
  }
}

async function dataspaceFetch(path, options = {}) {
  return fetchJson(`${dataspaceAdminApiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: participantHeaders(options.token),
    body: options.body,
    upstreamName: 'dataspace-admin',
  })
}

async function identityHubFetch(path, options = {}) {
  return fetchJson(`${identityHubIdentityApiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: await identityHubHeaders(),
    body: options.body,
    upstreamName: 'IdentityHub',
  })
}

async function fetchJson(url, { method, headers, body, upstreamName }) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...headers,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const responseText = await response.text()
  const payload = parsePayload(responseText)

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object'
        ? payload.error || payload.message || `${upstreamName} returned ${response.status}`
        : responseText || `${upstreamName} returned ${response.status}`
    const error = new Error(message)
    error.status = response.status >= 400 && response.status < 500 ? response.status : 502
    error.details = payload
    throw error
  }

  return payload
}

function participantHeaders(token) {
  return token ? { 'x-participant-token': token } : {}
}

async function identityHubHeaders() {
  const apiKey = await getIdentityHubApiKey()
  return apiKey ? { 'x-api-key': apiKey } : {}
}

async function assertIdentityHubConfigured() {
  const missing = []
  if (!identityHubIdentityApiUrl) missing.push('IDENTITYHUB_IDENTITY_API_URL')
  if (!identityHubParticipantContextId) missing.push('IDENTITYHUB_PARTICIPANT_CONTEXT_ID')
  if (!(await getIdentityHubApiKey())) missing.push('participant IdentityHub API key')
  if (missing.length) {
    const error = new Error(
      `Participant IdentityHub proxy is not configured: ${missing.join(', ')}. Initialize the participant IdentityHub context before requesting credentials.`,
    )
    error.status = 500
    throw error
  }
}

function getIdentityHubParticipantContextPathId() {
  return identityHubParticipantContextPathId || Buffer.from(identityHubParticipantContextId).toString('base64')
}

async function getIdentityHubApiKey() {
  if (identityHubApiKey) return identityHubApiKey
  if (cachedIdentityHubApiKey) return cachedIdentityHubApiKey
  if (!identityHubVaultUrl || !identityHubVaultToken) return ''

  try {
    const payload = await fetchVaultSecret(identityHubApiKeyVaultPath)
    const content = isRecord(payload)
      ? payload.data?.data?.content ?? payload.data?.content ?? payload.content
      : ''
    cachedIdentityHubApiKey = typeof content === 'string' ? content : ''
    return cachedIdentityHubApiKey
  } catch (error) {
    if (error.status === 404) return ''
    throw error
  }
}

async function fetchVaultSecret(path) {
  const paths = getVaultPathCandidates(path)
  let lastPayload = null
  let lastStatus = 0
  for (const candidate of paths) {
    const response = await fetch(`${identityHubVaultUrl}${candidate}`, {
      headers: { 'X-Vault-Token': identityHubVaultToken, Accept: 'application/json' },
    })
    const responseText = await response.text()
    const payload = parsePayload(responseText)
    if (response.ok) return payload
    lastPayload = payload
    lastStatus = response.status
  }

  const error = new Error(`IdentityHub API key Vault lookup failed with HTTP ${lastStatus}`)
  error.status = lastStatus === 404 ? 404 : 500
  error.details = lastPayload
  throw error
}

function getVaultPathCandidates(path) {
  const candidates = [path]
  if (path.includes('/secret/data/data/')) {
    candidates.push(path.replace('/secret/data/data/', '/secret/data/'))
  } else if (path.includes('/secret/data/')) {
    candidates.push(path.replace('/secret/data/', '/secret/data/data/'))
  }
  return [...new Set(candidates)]
}

async function proxyToPortal(request, response, url) {
  const target = new URL(`${url.pathname}${url.search}`, portalUpstreamUrl)
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value || hopByHopHeaders.has(key.toLowerCase())) continue
    if (Array.isArray(value)) headers.set(key, value.join(','))
    else headers.set(key, value)
  }
  headers.set('x-forwarded-host', request.headers.host ?? '')
  headers.set('x-forwarded-proto', 'http')

  const hasBody = !['GET', 'HEAD'].includes(request.method ?? 'GET')
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request : undefined,
    duplex: hasBody ? 'half' : undefined,
  })

  const responseHeaders = {}
  upstream.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) responseHeaders[key] = value
  })
  response.writeHead(upstream.status, responseHeaders)
  if (!upstream.body) {
    response.end()
    return
  }
  Readable.fromWeb(upstream.body).pipe(response)
}

async function serveOnboardingApp(response, url) {
  const pathname = decodeURIComponent(url.pathname)
  const hasExtension = Boolean(extname(pathname))
  const relativePath = hasExtension ? pathname.replace(/^\/+/, '') : 'index.html'
  const filePath = normalize(join(staticDir, relativePath))

  if (!filePath.startsWith(staticDir) || !existsSync(filePath)) {
    await sendStaticFile(response, join(staticDir, 'index.html'))
    return
  }
  await sendStaticFile(response, filePath)
}

async function sendStaticFile(response, filePath) {
  response.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
  })
  createReadStream(filePath).pipe(response)
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'text/html; charset=utf-8'
  }
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    const error = new Error('Invalid JSON body')
    error.status = 400
    throw error
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function extractCredentials(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.credentials)
      ? payload.credentials
      : isRecord(payload) && Array.isArray(payload.content)
        ? payload.content
        : []

  return raw.map((item, index) => {
    const record = isRecord(item) ? item : {}
    const vcContainer = isRecord(record.verifiableCredential) ? record.verifiableCredential : record
    const credential = isRecord(vcContainer.credential)
      ? vcContainer.credential
      : isRecord(record.credential)
        ? record.credential
        : record
    const metadata = isRecord(record.metadata) ? record.metadata : {}
    const typeValue = credential.type || record.type || record.credentialType || metadata.credentialObjectId
    const types = Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : []
    const issuerValue = credential.issuer || record.issuerId || record.issuer || ''
    const issuer = isRecord(issuerValue) ? issuerValue.id || '' : issuerValue
    return {
      id: String(record.id || credential.id || metadata.credentialObjectId || index),
      type: String(types.find((type) => type !== 'VerifiableCredential') || record.credentialType || 'credential'),
      issuer: String(issuer),
      state: String(record.status || (record.verifiableCredential ? 'ISSUED' : record.state || '')),
    }
  })
}

function normalizeCaseData(value) {
  if (!isRecord(value)) return {}
  return value
}

function parsePayload(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function text(value, fallback = '') {
  const normalized = String(value ?? fallback ?? '').trim()
  return normalized
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object')
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function buildDatabaseUrl() {
  const user = process.env.POSTGRES_USER ?? 'user'
  const password = process.env.POSTGRES_PASSWORD ?? 'password'
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@postgres:5432/participant_onboarding`
}

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

process.on('SIGTERM', async () => {
  server.close()
  await pool.end().catch(() => undefined)
})
