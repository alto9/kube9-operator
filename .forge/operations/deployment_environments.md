# Deployment Environments

## Chart Hosting

### Repository Infrastructure
- **Domain**: `charts.kube9.io`
- **Hosting**: Amazon S3 + CloudFront CDN
- **CDK Stack**: Located in `infrastructure/` directory
- **Index File**: Automated `index.yaml` generation on release
- **Chart Storage**: Helm charts stored in S3 bucket, served via CloudFront

### Chart Distribution
- Charts are automatically published when a GitHub Release is created (or a matching `v*` tag is pushed), after the **Release** workflow has been run manually so semantic-release can publish that release
- Repository index is updated automatically
- Charts are accessible via standard Helm commands:
  ```bash
  helm repo add kube9 https://charts.kube9.io
  helm install kube9-operator kube9/kube9-operator
  ```

## Image Publishing

### Container Registry
- **Registry**: GitHub Container Registry (GHCR)
- **Full Image Path**: `ghcr.io/alto9/kube9-operator`
- **Authentication**: Uses GitHub Actions secrets for registry authentication
- **Visibility**: Public repository, publicly accessible images

### Build Process
- **Trigger**: Image and chart workflows run when a release exists (published GitHub Release or `v*` tag), typically after maintainers run the **Release** workflow on `main`
- **Multi-Platform**: Supports multiple architectures (amd64, arm64)
- **Tagging Strategy**: 
  - Release tags match semantic version (e.g., `1.3.0`)
  - `latest` tag points to most recent release
- **Image Manifest**: Multi-arch manifests for cross-platform support

### Image Lifecycle
- Images are built and pushed automatically on release
- Old images are retained for rollback purposes
- Image tags match Git release tags

## Local Testing & Development

Procedures below map to scripts in `scripts/` and npm scripts in `package.json`. Use the path that matches what you are validating.

### Quick reference

| Goal | What to run | Notes |
|------|-------------|--------|
| Fast feedback (no cluster) | `npm test`, `npm run test:unit`, `npm run test:integration` | Vitest; `test:integration` covers database-heavy paths locally (no Kubernetes required) |
| Disposable cluster + Helm E2E | `./scripts/test-helm-chart.sh` | Phases 1–4 always (lint, template, package). Phase 5 creates **kind** cluster `kube9-test`, install/upgrade/uninstall, then deletes cluster. Skips Phase 5 if `kind` is missing. Requires `jq` for status ConfigMap assertions in Phase 5 |
| Local Minikube for dev / demos | **[kube9-localcluster](https://github.com/alto9/kube9-localcluster)** `scripts/start.sh`, `scripts/populate.sh` | Creates profile `kube9-demo` (default), writes `out/kubeconfig`. This repo does **not** create clusters. |
| In-cluster image on Minikube | `npm run deploy:minikube` → `scripts/deploy-minikube.sh` | After localcluster is running: builds `kube9-operator:local`, `minikube -p $MINIKUBE_PROFILE image load`, Helm with local image overrides. `MINIKUBE_PROFILE` defaults to `kube9-demo`. |
| Operator process on host + API access | `export KUBECONFIG=.../kube9-localcluster/out/kubeconfig` then `npm run dev` or `npm run dev:watch` | Cluster must already exist; use kube9-localcluster to create it |
| Uninstall from current context | `npm run clean:minikube` | `helm uninstall kube9-operator -n kube9-system` |

### Minikube profile and kubectl context

`scripts/deploy-minikube.sh` passes **`MINIKUBE_PROFILE`** (default **`kube9-demo`**) to all `minikube` subcommands. Set **`KUBECONFIG`** to the file from kube9-localcluster (`out/kubeconfig`) so `kubectl` and `helm` target the same cluster as `minikube image load`.

- **Scenario / extension demos** — In kube9-localcluster, `./scripts/populate.sh with-operator` installs the chart from disk plus demo workloads (chart default image is often GHCR, not your local build).
- **Local operator image iteration** — From this repo, `npm run deploy:minikube` after `export KUBECONFIG` to that cluster.

### Script details

**`scripts/deploy-minikube.sh`** — Prerequisites: `docker`, `minikube`, `helm`, `kubectl`; cluster must already be running (e.g. kube9-localcluster). Produces image `kube9-operator:local`, loads into the Minikube node for `MINIKUBE_PROFILE`, deploys `./charts/kube9-operator` with local image overrides.

**`scripts/test-helm-chart.sh`** — Chart path `charts/kube9-operator`; release `kube9-operator`, namespace `kube9-system`. Uses published chart defaults for the in-cluster image during Phase 5 (pull from registry per `values.yaml`), not the local Docker tag.

**`npm run test:minikube`** — Placeholder in `package.json` (not a working harness); prefer `./scripts/test-helm-chart.sh` or `deploy:minikube` for cluster validation.

### kube9-localcluster (related repo)

Shared local cluster for **kube9-vscode** and **kube9-operator** development: [kube9-localcluster](https://github.com/alto9/kube9-localcluster).

- **Start**: `./scripts/start.sh` — profile `kube9-demo`, writes `out/kubeconfig`.
- **Operator scenario**: `./scripts/populate.sh with-operator` — sibling `kube9-operator` for chart path unless `KUBE9_OPERATOR_ROOT` is set; Helm defaults often pull GHCR, not `kube9-operator:local`.
- **Local image**: From this repo, `export KUBECONFIG` to `out/kubeconfig` and run `npm run deploy:minikube`.

### Environment variables (local)

- Host-run dev: `LOG_LEVEL`, `DB_PATH` (defaults to `./.kube9-data` when unset in `npm run dev` / `dev:watch`), `POD_NAMESPACE`, `HEALTH_PORT` (default `8080`); see `.env.example`.
- In-cluster: override via Helm values (e.g. `logLevel: debug`) on install/upgrade.
