# Deployment Environments

## Chart Hosting

### Repository Infrastructure
- **Domain**: `charts.kube9.io`
- **Hosting**: Amazon S3 + CloudFront CDN
- **CDK Stack**: Located in `infrastructure/` directory
- **Index File**: Automated `index.yaml` generation on release
- **Chart Storage**: Helm charts stored in S3 bucket, served via CloudFront

### Chart Distribution
- Charts are automatically published when a GitHub Release is created (or a matching `v*` tag is pushed), after **[Cut Release](../../.github/workflows/cut-release.yml)** has been run manually so semantic-release can publish that release
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
- **Trigger**: Image and chart workflows run when a release exists (published GitHub Release or `v*` tag), typically after maintainers run **Cut Release** on `main`
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
| Local Minikube for dev / demos | **[kube9-minikube](https://github.com/alto9/kube9-minikube)** `scripts/start.sh`, `scripts/populate.sh` | Creates profile `kube9-demo` (default), writes `out/kubeconfig`. This repo does **not** create clusters. |
| In-cluster image on Minikube | `npm run deploy:minikube` → `scripts/deploy-minikube.sh` | After localcluster is running: builds `kube9-operator:local`, `minikube -p $MINIKUBE_PROFILE image load`, Helm with local image overrides. `MINIKUBE_PROFILE` defaults to `kube9-demo`. |
| Operator process on host + API access | `export KUBECONFIG=.../kube9-minikube/out/kubeconfig` then `npm run dev` or `npm run dev:watch` | Cluster must already exist; use kube9-minikube to create it |
| Uninstall from current context | `npm run clean:minikube` | `helm uninstall kube9-operator -n kube9-system` |

### Minikube profile and kubectl context

`scripts/deploy-minikube.sh` passes **`MINIKUBE_PROFILE`** (default **`kube9-demo`**) to all `minikube` subcommands. Set **`KUBECONFIG`** to the file from kube9-minikube (`out/kubeconfig`) so `kubectl` and `helm` target the same cluster as `minikube image load`.

- **Scenario / extension demos** — In kube9-minikube, `./scripts/populate.sh with-operator` installs the chart from disk plus demo workloads (chart default image is often GHCR, not your local build).
- **Local operator image iteration** — From this repo, `npm run deploy:minikube` after `export KUBECONFIG` to that cluster.

### Script details

**`scripts/deploy-minikube.sh`** — Prerequisites: `docker`, `minikube`, `helm`, `kubectl`; cluster must already be running (e.g. kube9-minikube). Produces image `kube9-operator:local`, loads into the Minikube node for `MINIKUBE_PROFILE`, deploys `./charts/kube9-operator` with local image overrides.

**`scripts/test-helm-chart.sh`** — Chart path `charts/kube9-operator`; release `kube9-operator`, namespace `kube9-system`. Uses published chart defaults for the in-cluster image during Phase 5 (pull from registry per `values.yaml`), not the local Docker tag.

**`npm run test:minikube`** — Placeholder in `package.json` (not a working harness); prefer `./scripts/test-helm-chart.sh` or `deploy:minikube` for cluster validation.

### kube9-minikube (related repo)

Shared local cluster for **kube9-vscode** and **kube9-operator** development: [kube9-minikube](https://github.com/alto9/kube9-minikube).

- **Start**: `./scripts/start.sh` — profile `kube9-demo`, writes `out/kubeconfig`.
- **Operator scenario**: `./scripts/populate.sh with-operator` — sibling `kube9-operator` for chart path unless `KUBE9_OPERATOR_ROOT` is set; Helm defaults often pull GHCR, not `kube9-operator:local`.
- **Local image**: From this repo, `export KUBECONFIG` to `out/kubeconfig` and run `npm run deploy:minikube`.

### Environment variables (local)

- Host-run dev: `LOG_LEVEL`, `DB_PATH` (defaults to `./.kube9-data` when unset in `npm run dev` / `dev:watch`), `POD_NAMESPACE`, `HEALTH_PORT` (default `8080`); see `.env.example`.
- In-cluster: override via Helm values (e.g. `logLevel: debug`) on install/upgrade.

## Agent / Desktop history consumers (availability)

Desktop and other clients may query retained events and assessments history via the existing in-pod CLI (`kubectl exec`). Delivery posture for that path:

- **Optional for Pro debugging:** Product acceptance for debugging does not require operator install. Operator absence or unreadiness is a Tier 2 gap, not a failed delivery environment.
- **Best-effort when ready + PVC:** Queryable history is available when the operator Deployment is ready and SQLite is on the chart-default PersistentVolumeClaim (`events.persistence.enabled = true`). No HA, multi-replica, or external query SLA for agent consumers.
- **Persistence disabled:** With `events.persistence.enabled = false` (`emptyDir`), history is ephemeral across pod restarts. Consumers treat that as operator-history degraded or absent, not as a separate environment tier.
- **No log-capture ops:** Operations contracts do not add log retention, log PVC sizing, failure-log capture runbooks, or pruned-log recovery. That remains a separate epic.
- **Assessment history:** No ops-owned time-based TTL or cleanup schedule for assessment rows. Storage growth under frequent assessments is a data-domain concern unless a later epic adds policy.
- **Collections (append-only, no TTL):** SQLite `collections` has no time-based TTL or count-based cap in this product lane (same class as assessments). Finishing performance (~15m) and security-posture (~24h) collectors increases append volume on the chart-default PVC. That is an operational disk-growth concern for platform admins, not a new environment tier, retention SLA, or chart prune knob. No phone-home / kube9-api export path is introduced.
- **No new delivery tier:** Performance Prometheus outbound and security-posture cluster-API reads stay on the existing Helm / GHCR / kind / minikube path. Zero-ingress default and optional-integration degrade posture are unchanged. Agent / Desktop remain read-only progressive-enhancement peers for this collector milestone.

### Open implementation decisions

- **Local dogfood paths:** Whether minikube / kind checklists should call out an explicit operator-present vs operator-absent history query smoke step (Desktop owns acceptance scoring; operator side only needs confirmable query + chart defaults).
- **emptyDir wording in install docs:** Exact operator install-doc phrasing that persistence-off means ephemeral history for agent/evidence consumers (packaging already documents the volume switch).
- **Collector smoke in Helm Phase 5 / minikube:** Whether `test-helm-chart.sh` Phase 5 or deploy:minikube docs assert new interval env keys and (when Prometheus is absent) graceful performance-collector degrade without failing readiness; exact assertions stay refine-issue / harness work.
