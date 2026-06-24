#!/bin/sh
set -eu

log() {
    printf '%s\n' "$*"
}

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

urlencode() {
    jq -nr --arg value "$1" '$value | @uri'
}

wait_for_http() {
    name="$1"
    url="$2"
    attempts="${3:-90}"
    i=0

    printf 'Waiting for %s' "$name"
    while [ "$i" -lt "$attempts" ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            printf ' OK\n'
            return 0
        fi
        i=$((i + 1))
        sleep 2
        printf '.'
    done
    printf ' TIMEOUT\n'
    return 1
}

vault_get() {
    vault_addr="$1"
    key="$2"

    for path in "data/${key}" "data/data/${key}"; do
        response="$(curl -sf \
            -H "X-Vault-Token: ${VAULT_TOKEN}" \
            "${vault_addr}/v1/secret/${path}" 2>/dev/null || true)"
        if [ -n "$response" ]; then
            printf '%s' "$response" | jq -er '.data.data.content'
            return 0
        fi
    done

    return 1
}

wait_vault_get() {
    vault_addr="$1"
    key="$2"
    attempts="${3:-60}"
    i=0

    while [ "$i" -lt "$attempts" ]; do
        value="$(vault_get "$vault_addr" "$key" 2>/dev/null || true)"
        if [ -n "$value" ] && [ "$value" != "null" ]; then
            printf '%s' "$value"
            return 0
        fi
        i=$((i + 1))
        sleep 2
    done

    return 1
}

vault_put() {
    vault_addr="$1"
    key="$2"
    content="$3"

    jq -n --arg content "$content" '{data:{content:$content}}' |
        curl -sf -X POST "${vault_addr}/v1/secret/data/${key}" \
            -H "X-Vault-Token: ${VAULT_TOKEN}" \
            -H "Content-Type: application/json" \
            -d @- >/dev/null
}

http_status_with_body() {
    method="$1"
    url="$2"
    body="${3:-}"
    tmp="$(mktemp)"

    if [ -n "$body" ]; then
        code="$(curl -s -w '%{http_code}' -o "$tmp" \
            -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -H "x-api-key: ${IDENTITYHUB_API_KEY}" \
            -d "$body" 2>/dev/null || true)"
    else
        code="$(curl -s -w '%{http_code}' -o "$tmp" \
            -X "$method" "$url" \
            -H "x-api-key: ${IDENTITYHUB_API_KEY}" 2>/dev/null || true)"
    fi

    response_body="$(cat "$tmp")"
    rm -f "$tmp"
    printf '%s\n%s' "$code" "$response_body"
}

PARTICIPANT_ROLE="${PARTICIPANT_ROLE:-participant}"
PARTICIPANT_BPN="${PARTICIPANT_BPN:-BPNL00000003AYRE}"
IDENTITYHUB_CONTEXT_ID="${IDENTITYHUB_PARTICIPANT_CONTEXT_ID:-$PARTICIPANT_BPN}"
PARTICIPANT_DID_HOST="${PARTICIPANT_DID_HOST:-participant.external.test}"
PARTICIPANT_PUBLIC_HOST="${PARTICIPANT_PUBLIC_HOST:-$PARTICIPANT_DID_HOST}"
PARTICIPANT_DID="did:web:${PARTICIPANT_DID_HOST}:${PARTICIPANT_BPN}"
PARTICIPANT_KEY_ALIAS="${IDENTITYHUB_KEY_ALIAS:-${PARTICIPANT_BPN}-key-1}"

IDENTITYHUB_IDENTITY_URL="${IDENTITYHUB_IDENTITY_URL:-http://identityhub:8082/api/identity}"
IDENTITYHUB_HEALTH_URL="${IDENTITYHUB_HEALTH_URL:-http://identityhub:8081/api/check/health}"
WALLET_VAULT_ADDR="${WALLET_VAULT_ADDR:-http://wallet-vault:8200}"
CONNECTOR_VAULT_ADDR="${CONNECTOR_VAULT_ADDR:-http://connector-vault:8200}"
VAULT_TOKEN="${VAULT_DEV_ROOT_TOKEN_ID:-${VAULT_TOKEN:-root}}"

PARTICIPANT_BPN_BASE64="${PARTICIPANT_BPN_BASE64:-$(printf '%s' "$PARTICIPANT_BPN" | base64 | tr -d '\n')}"
PUBLIC_DSP_CALLBACK_ADDRESS="${PUBLIC_DSP_CALLBACK_ADDRESS:-https://${PARTICIPANT_PUBLIC_HOST}/api/v1/dsp}"
PUBLIC_CREDENTIAL_SERVICE_ENDPOINT="${PUBLIC_CREDENTIAL_SERVICE_ENDPOINT:-https://${PARTICIPANT_PUBLIC_HOST}/api/credentials/v1/participants/${PARTICIPANT_BPN_BASE64}}"

wait_for_http "IdentityHub" "$IDENTITYHUB_HEALTH_URL"

if [ -z "${IDENTITYHUB_API_KEY:-}" ]; then
    IDENTITYHUB_API_KEY="$(wait_vault_get "$WALLET_VAULT_ADDR" super-user-apikey)" ||
        fail "IdentityHub super-user API key unavailable in wallet Vault"
fi

manifest="$(jq -n \
    --arg did "$PARTICIPANT_DID" \
    --arg bpn "$PARTICIPANT_BPN" \
    --arg contextId "$IDENTITYHUB_CONTEXT_ID" \
    --arg keyAlias "$PARTICIPANT_KEY_ALIAS" \
    --arg credentialEndpoint "$PUBLIC_CREDENTIAL_SERVICE_ENDPOINT" \
    --arg credentialId "${PARTICIPANT_ROLE}-credentialservice" \
    --arg dspEndpoint "$PUBLIC_DSP_CALLBACK_ADDRESS" \
    --arg dspId "${PARTICIPANT_ROLE}-dsp" \
    '{
        roles: [],
        serviceEndpoints: [
            {
                type: "CredentialService",
                serviceEndpoint: $credentialEndpoint,
                id: $credentialId
            },
            {
                type: "ProtocolEndpoint",
                serviceEndpoint: $dspEndpoint,
                id: $dspId
            }
        ],
        active: true,
        participantContextId: $contextId,
        participantId: $bpn,
        did: $did,
        key: {
            keyId: ($did + "#key-1"),
            privateKeyAlias: $keyAlias,
            keyGeneratorParams: {algorithm: "EdDSA"}
        }
    }')"

log "Creating IdentityHub participant context ${IDENTITYHUB_CONTEXT_ID}"
result="$(http_status_with_body POST "${IDENTITYHUB_IDENTITY_URL}/v1alpha/participants/" "$manifest")"
status="$(printf '%s' "$result" | sed -n '1p')"
body="$(printf '%s' "$result" | sed '1d')"
case "$status" in
    200|201|204) log "IdentityHub participant context created" ;;
    409) log "IdentityHub participant context already exists" ;;
    *) printf '%s\n' "$body" >&2; fail "participant context creation failed with HTTP ${status}" ;;
esac

encoded_context_id="$(urlencode "$IDENTITYHUB_CONTEXT_ID")"
log "Activating IdentityHub participant context ${IDENTITYHUB_CONTEXT_ID}"
result="$(http_status_with_body POST "${IDENTITYHUB_IDENTITY_URL}/v1alpha/participants/${encoded_context_id}/state?isActive=true")"
status="$(printf '%s' "$result" | sed -n '1p')"
body="$(printf '%s' "$result" | sed '1d')"
case "$status" in
    200|204) log "IdentityHub participant context active" ;;
    *) printf '%s\n' "$body" >&2; fail "participant context activation failed with HTTP ${status}" ;;
esac

log "Syncing participant STS and token signer secrets to connector Vault"
sts_secret="$(wait_vault_get "$WALLET_VAULT_ADDR" "${PARTICIPANT_BPN}-sts-client-secret")" ||
    fail "STS client secret ${PARTICIPANT_BPN}-sts-client-secret unavailable in wallet Vault"
participant_key="$(wait_vault_get "$WALLET_VAULT_ADDR" "$PARTICIPANT_KEY_ALIAS")" ||
    fail "participant key ${PARTICIPANT_KEY_ALIAS} unavailable in wallet Vault"

vault_put "$CONNECTOR_VAULT_ADDR" sts-oauth-client-secret "$sts_secret"
vault_put "$CONNECTOR_VAULT_ADDR" token-signer-key "$participant_key"
log "Participant init complete"
