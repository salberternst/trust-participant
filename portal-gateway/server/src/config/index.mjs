import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? buildDatabaseUrl(),
  portalUpstreamUrl: trimTrailingSlash(process.env.PORTAL_UPSTREAM_URL ?? 'http://portal:80'),
  dataspaceAdminApiUrl: trimTrailingSlash(
    process.env.ONBOARDING_DATASPACE_ADMIN_API_URL ??
      process.env.DATASPACE_ADMIN_API_URL ??
      'http://dataspace-admin:3000/api',
  ),
  identityHub: {
    identityApiUrl: trimTrailingSlash(
      process.env.IDENTITYHUB_IDENTITY_API_URL ?? 'http://identityhub:8082/api/identity',
    ),
    participantContextId: process.env.IDENTITYHUB_PARTICIPANT_CONTEXT_ID ?? process.env.PARTICIPANT_BPN ?? '',
    participantContextPathId: process.env.IDENTITYHUB_PARTICIPANT_CONTEXT_PATH_ID ?? '',
    apiKey: process.env.IDENTITYHUB_API_KEY ?? '',
    vaultUrl: trimTrailingSlash(process.env.IDENTITYHUB_VAULT_URL ?? ''),
    vaultToken: process.env.IDENTITYHUB_VAULT_TOKEN ?? '',
    apiKeyVaultPath: process.env.IDENTITYHUB_API_KEY_VAULT_PATH ?? '/v1/secret/data/super-user-apikey',
  },
  staticDir: join(fileURLToPath(new URL('../../..', import.meta.url)), 'dist'),
  stateId: 'default',
  onboardingAutoSubmit: process.env.ONBOARDING_AUTO_SUBMIT !== 'false',
}

export function onboardingDefaults() {
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

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function buildDatabaseUrl() {
  const user = process.env.POSTGRES_USER ?? 'user'
  const password = process.env.POSTGRES_PASSWORD ?? 'password'
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@postgres:5432/participant_onboarding`
}
