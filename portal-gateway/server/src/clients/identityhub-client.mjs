import { config } from '../config/index.mjs'
import { fetchJson } from '../lib/http-client.mjs'
import { getIdentityHubApiKey } from '../services/identityhub-api-key-service.mjs'
import { httpError } from '../lib/http-errors.mjs'

export async function identityHubFetch(path, options = {}) {
  return fetchJson(`${config.identityHub.identityApiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: await identityHubHeaders(),
    body: options.body,
    upstreamName: 'IdentityHub',
  })
}

export async function assertIdentityHubConfigured() {
  const missing = []
  if (!config.identityHub.identityApiUrl) missing.push('IDENTITYHUB_IDENTITY_API_URL')
  if (!config.identityHub.participantContextId) missing.push('IDENTITYHUB_PARTICIPANT_CONTEXT_ID')
  if (!(await getIdentityHubApiKey())) missing.push('participant IdentityHub API key')
  if (missing.length) {
    throw httpError(
      500,
      `Participant IdentityHub proxy is not configured: ${missing.join(', ')}. Initialize the participant IdentityHub context before requesting credentials.`,
    )
  }
}

export function getIdentityHubParticipantContextPathId() {
  return (
    config.identityHub.participantContextPathId ||
    Buffer.from(config.identityHub.participantContextId).toString('base64')
  )
}

async function identityHubHeaders() {
  const apiKey = await getIdentityHubApiKey()
  return apiKey ? { 'x-api-key': apiKey } : {}
}
