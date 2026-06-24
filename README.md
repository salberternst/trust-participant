# Trust Participant

Reusable Docker Compose stack for one dataspace participant: IdentityHub, Tractus-X EDC control plane, data plane, Postgres, Vault, and public/internal gateways.

## Quick Start

```sh
cp .env.example .env
docker compose up -d
```

This starts one participant runtime. The public and internal gateways bind to loopback by default for local safety.

## Participant Init

`participant-init` is a one-shot service that provisions the participant wallet before the connector starts. It uses a published helper image so this compose file can be included from an OCI registry.

It does the participant-local setup only:

- waits for IdentityHub,
- reads the IdentityHub super-user API key from wallet Vault unless `IDENTITYHUB_API_KEY` is set,
- creates the IdentityHub participant context as active,
- copies the generated STS client secret and participant signing key into connector Vault.

BDRS registration, demo assets, credential issuance, and onboarding belong to the trust operator or a higher-level deployment stack.

For local init image development:

```sh
docker build -t trust-participant-init:local init
PARTICIPANT_INIT_IMAGE=trust-participant-init:local docker compose up -d
```

## Network Model

| Surface | Compose network | Example URL | Purpose |
| --- | --- | --- | --- |
| Docker-internal | `backend` | none | Postgres, Vault, and init jobs. No host ports. |
| Internal/company | `internal` | `participant.internal.test`, `portal.internal.test` | Private participant APIs and optional portals. |
| Public dataspace | `public` | `participant.external.test` | Public gateway routes required for federation. |

Only gateways join the `public` network. IdentityHub, control plane, and data plane stay on `internal`; Postgres, Vault, and init jobs stay on `backend`.

## Public Routes

A participant needs one externally reachable hostname:

```env
PARTICIPANT_PUBLIC_HOST=participant.external.test
PARTICIPANT_DID_HOST=participant.external.test
```

The participant DID becomes `did:web:${PARTICIPANT_DID_HOST}:${PARTICIPANT_BPN}`.

| Public route | Backend | Purpose |
| --- | --- | --- |
| `/${PARTICIPANT_BPN}/did.json` and `/.well-known/did.json` | IdentityHub DID API | DID resolution. |
| `/api/v1/dsp/*` | EDC control plane protocol API | Dataspace Protocol callbacks. |
| `/api/public/*` | EDC data plane public API | Public data access endpoint. |
| `/api/credentials/*` | IdentityHub credential API | Credential issuance and wallet interactions. |
| `/.well-known/api/*` | EDC control plane version API | Optional protocol/version discovery. |

Do not expose EDC management, IdentityHub identity/admin APIs, Vault, or Postgres through the public hostname.

## Configuration

Most settings have local defaults in `.env.example`. These are the important deployment knobs:

| Variable | Example | Notes |
| --- | --- | --- |
| `PARTICIPANT_BPN` | `BPNL00000003AYRE` | Dataspace participant BPN. |
| `PARTICIPANT_BPN_BASE64` | `QlBOTDAwMDAwMDAzQVlSRQ==` | Base64 form of `PARTICIPANT_BPN`, used in credential-service URLs. |
| `PARTICIPANT_CONTEXT_ID` | `596b0330-76ec-5c8e-af01-24ba6a21d4e6` | Connector runtime context id. Keep stable and unique per participant deployment. |
| `IDENTITYHUB_PARTICIPANT_CONTEXT_ID` | `BPNL00000003AYRE` | Wallet participant context id. Defaults to the BPN and should usually stay aligned with `PARTICIPANT_BPN`. |
| `PARTICIPANT_PUBLIC_HOST` | `participant.external.test` | Public hostname for DSP, credentials, DID resolution, and data-plane access. |
| `PARTICIPANT_DID_HOST` | `participant.external.test` | Hostname encoded in the `did:web` identifier. Usually the same as `PARTICIPANT_PUBLIC_HOST`. |
| `PUBLIC_DSP_CALLBACK_ADDRESS` | `https://participant.external.test/api/v1/dsp` | Public DSP callback URL. |
| `PUBLIC_DATAPLANE_BASE_URL` | `https://participant.external.test/api/public/` | Public data-plane base URL. Keep the trailing slash. |
| `PUBLIC_CREDENTIAL_SERVICE_ENDPOINT` | empty | Optional. Leave empty to derive it from `PARTICIPANT_PUBLIC_HOST` and `PARTICIPANT_BPN_BASE64`. |
| `BDRS_SERVER_URL` | `https://issuer.external.test/api/directory` | Trust operator BDRS directory URL. |
| `ISSUER_DID_HOST`, `BPN_ISSUER` | `issuer.external.test`, `BPNL00000003CRHK` | Trusted issuer DID host and BPN. |
| `TRUST_PARTICIPANT_PUBLIC_NETWORK` | `trust-public` | Shared public Docker network for the public gateway. |
| `TRUST_PARTICIPANT_PUBLIC_NETWORK_EXTERNAL` | `false` | Set to `true` when another stack owns the public network. |

`PARTICIPANT_INTERNAL_HOST` names the private gateway for company/VPN/local-only access to management and identity APIs.

## Publish as OCI

Tag pushes publish both artifacts to GHCR via `.github/workflows/publish-compose.yml`. A Git tag like `v0.1.0` publishes:

```text
ghcr.io/salberternst/trust-participant:0.1.0
ghcr.io/salberternst/trust-participant-init:0.1.0
```

On tag pushes, `latest` is published too. The semantic-dataspace participant overlays include the compose artifact directly:

```yaml
include:
  - path: oci://ghcr.io/salberternst/trust-participant:0.1.0
```
