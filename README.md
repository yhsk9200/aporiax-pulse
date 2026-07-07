# aporiax pulse

Live status dashboard for the [gitops-infra](https://github.com/yhsk9200/gitops-infra) k3s platform — this page is served by the cluster it reports on.

Deployed at `https://pulse.aporiax.duckdns.org`.

## What it shows

- ArgoCD Application sync/health status (read from the k8s API via in-cluster ServiceAccount RBAC — no ArgoCD-specific token)
- Node CPU/memory/uptime (Prometheus HTTP API)
- TLS certificate expiry for the platform's public domains (live handshake, works from anywhere)

Panels that need in-cluster access degrade gracefully outside the cluster — this is what you see running `npm run dev` locally: the TLS panel stays live, the ArgoCD/Node panels show an explicit "Unavailable" state instead of crashing or faking data.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build & run as a container

```bash
docker build --platform linux/arm64 -t aporiax-pulse:local .
docker run -p 3000:3000 aporiax-pulse:local
```

## Deployment

This repo ships its own ArgoCD App-of-Apps under `deploy/` (see `deploy/root/root-app.yaml`). The platform repo (`gitops-infra`) only registers an `AppProject` scoping this repo/namespace and a root `Application` pointing here — see ADR-0005 (product-unit repo boundary) and ADR-0007 (first product tenant onboarding) there.
