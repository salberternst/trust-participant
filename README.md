# Trust Participant

Reusable Docker Compose stack for one dataspace participant: IdentityHub, DID routing, Tractus-X EDC control plane, data plane, Postgres, and local Vault instances.

## Quick Start

```sh
cp .env.example .env
docker compose --profile edge up -d
```

Use `--profile edge` when running this repo by itself; it creates a Docker network named by `TRUST_PARTICIPANT_EDGE_NETWORK`. When another stack already owns that network, leave the profile off and set `TRUST_PARTICIPANT_EDGE_NETWORK_EXTERNAL=true`.

## Public Routes

The participant must expose these externally for real federation:

| Route | Backend | Why it must be reachable |
| --- | --- | --- |
| `/.well-known/did.json` and DID document paths below `/${PARTICIPANT_BPN}` | `identityhub:8084` | Resolves `did:web:${PARTICIPANT_DID_HOST}:${PARTICIPANT_BPN}` |
| `/api/v1/dsp/*` | `controlplane:8084` | Dataspace Protocol callbacks from other connectors |
| `/api/public/*` | `dataplane:8081` | Public data plane endpoint announced in transfer processes |
| `/.well-known/api/*` | `controlplane:8085` | Optional version discovery |

Do not expose `/management`, IdentityHub identity/admin APIs, Vault, or Postgres to the public internet.

## Routing

The included `edge` service is an Nginx router suitable for local and single-host deployments. In production you can replace it with Traefik, an ingress controller, or a platform load balancer as long as the public routes above keep the same external URLs.

Set:

- `PARTICIPANT_DID_HOST` to the public host used in the DID.
- `PUBLIC_DSP_CALLBACK_ADDRESS` to the externally reachable DSP callback URL.
- `PUBLIC_DATAPLANE_BASE_URL` to the externally reachable data plane public URL.
- `BDRS_SERVER_URL` to the trust operator BDRS directory URL.
- `ISSUER_DID_HOST` and `BPN_ISSUER` to the trusted issuer DID host and BPN.

For local compose-only scenarios, the semantic dataspace stack sets these to Docker DNS aliases such as `provider-did` and `bdrs-server`.


## Publish as OCI

This repo includes a GitHub Actions workflow that publishes the Compose app to GitHub Container Registry.

Push a tag to publish:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow publishes:

```text
ghcr.io/<owner>/<repo>:0.1.0
ghcr.io/<owner>/<repo>:latest
```

Consumers can include the artifact with:

```yaml
include:
  - oci://ghcr.io/<owner>/<repo>:0.1.0
```
