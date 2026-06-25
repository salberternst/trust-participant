import { config } from '../config/index.mjs'
import { parsePayload, isRecord } from '../lib/objects.mjs'

let cachedIdentityHubApiKey = ''

export async function getIdentityHubApiKey() {
  if (config.identityHub.apiKey) return config.identityHub.apiKey
  if (cachedIdentityHubApiKey) return cachedIdentityHubApiKey
  if (!config.identityHub.vaultUrl || !config.identityHub.vaultToken) return ''

  try {
    const payload = await fetchVaultSecret(config.identityHub.apiKeyVaultPath)
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
    const response = await fetch(`${config.identityHub.vaultUrl}${candidate}`, {
      headers: { 'X-Vault-Token': config.identityHub.vaultToken, Accept: 'application/json' },
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
