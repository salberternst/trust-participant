# Trust Participant

Reusable Docker Compose stack for one dataspace participant: IdentityHub, public DID/DSP routing, Tractus-X EDC control plane, data plane, Postgres, and local Vault instances.

## Quick Start

```sh
cp .env.example .env
docker compose up -d
```

This starts the participant runtime plus two gateway surfaces: the public dataspace gateway and the private internal gateway. Both bind to loopback by default for local safety. A one-shot `participant-init` service provisions the participant wallet before the connector starts.

## Participant Init

The `participant-init` service uses a published helper image, not a local Compose build context. That keeps the Compose file usable when it is included from an OCI registry. The init job:

- waits for the local IdentityHub health endpoint,
- reads the IdentityHub super-user API key from the wallet Vault unless `IDENTITYHUB_API_KEY` is set,
- creates the IdentityHub participant context if it does not already exist,
- requests the participant context as active during creation,
- copies the generated STS client secret and participant signing key into the connector Vault.

It does not register BDRS entries, create demo assets, request credentials, call the IdentityHub participant state endpoint, or touch IdentityHub tables directly. Those belong to the operator, onboarding flow, or demo stack.

For local image development:

```sh
docker build -t trust-participant-init:local init
PARTICIPANT_INIT_IMAGE=trust-participant-init:local docker compose up -d
```

## Network Model

The compose file separates the participant into three surfaces:

| Surface | Compose network | Example URL | Purpose |
| --- | --- | --- | --- |
| Docker-internal | `backend` | none | Postgres, Vault, and init jobs. No host ports and no public ingress. |
| Internal/company | `internal` | `participant.internal.test`, `portal.internal.test` | Private participant APIs and optional portals that should be reachable only inside the company or local Docker stack. |
| Public dataspace | `public` | `participant.external.test` | Public gateway routes required for federation with other dataspace participants and trust services. |

Only gateway services join the `public` network. Core services such as IdentityHub, control plane, and data plane stay on `internal`; databases and Vaults stay on `backend`.

## Required Public URL

A participant needs one public hostname:

```env
PARTICIPANT_PUBLIC_HOST=participant.external.test
PARTICIPANT_DID_HOST=participant.external.test
```

The participant DID becomes:

```text
did:web:${PARTICIPANT_DID_HOST}:${PARTICIPANT_BPN}
```

The public gateway routes these externally reachable paths:

| Public route | Backend | Why it must be reachable |
| --- | --- | --- |
| `/${PARTICIPANT_BPN}/did.json` and `/.well-known/did.json` | IdentityHub DID API | DID resolution for `did:web` identities. |
| `/api/v1/dsp/*` | EDC control plane protocol API | Dataspace Protocol callbacks from counterparties. |
| `/api/public/*` | EDC data plane public API | Public data plane endpoint announced in transfer processes. |
| `/api/credentials/*` | IdentityHub credential API | Credential issuance and participant wallet interactions. |
| `/.well-known/api/*` | EDC control plane version API | Optional protocol/version discovery. |

Do not expose EDC management, IdentityHub identity/admin APIs, Vault, or Postgres through the public hostname.

## Internal URL

The internal gateway is for private operations and tooling. Keep this hostname on a company, VPN, or local-only network:

```env
PARTICIPANT_INTERNAL_HOST=participant.internal.test
```

It can route private endpoints such as EDC management and IdentityHub identity APIs. A portal can be added by an overlay stack on the same `internal` network and exposed as a separate internal hostname, for example `portal.internal.test`.

## Routing

The included public and internal gateways are Nginx services suitable for local and single-host deployments. In production, you can replace them with Traefik, an ingress controller, or a platform load balancer as long as the same public routes stay reachable at `PARTICIPANT_PUBLIC_HOST`.

Set:

- `PARTICIPANT_PUBLIC_HOST` to the externally reachable participant hostname.
- `PARTICIPANT_DID_HOST` to the host used in the participant DID, usually the same as `PARTICIPANT_PUBLIC_HOST`.
- `PUBLIC_DSP_CALLBACK_ADDRESS` to `https://${PARTICIPANT_PUBLIC_HOST}/api/v1/dsp`.
- `PUBLIC_DATAPLANE_BASE_URL` to `https://${PARTICIPANT_PUBLIC_HOST}/api/public`.
- `PUBLIC_CREDENTIAL_SERVICE_ENDPOINT` to `https://${PARTICIPANT_PUBLIC_HOST}/api/credentials/v1/participants/<bpn-base64>`.
- `BDRS_SERVER_URL` to the trust operator BDRS directory URL.
- `ISSUER_DID_HOST` and `BPN_ISSUER` to the trusted issuer DID host and BPN.

For local compose-only scenarios, an overlay stack may set these to Docker DNS aliases such as `provider-did` and `bdrs-server`.

## Publish as OCI

This repo includes a GitHub Actions workflow that publishes the Compose app to GitHub Container Registry. The compose file is self-contained: small Postgres, logging, and Nginx configs are embedded with Compose `configs.content`, so it can be published as an OCI Compose artifact.

Push a tag to publish:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow publishes the Compose artifact and the init image:

```text
ghcr.io/<owner>/<repo>:0.1.0
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>-init:0.1.0
ghcr.io/<owner>/<repo>-init:latest
```

Consumers can include the artifact with:

```yaml
include:
  - oci://ghcr.io/<owner>/<repo>:0.1.0
```
