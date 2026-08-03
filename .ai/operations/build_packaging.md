# Build & Packaging

## Helm Chart

### Chart Information
- **Name**: kube9-operator
- **Repository URL**: https://charts.kube9.io
- **Chart Version**: Follows SemVer (currently 1.3.0)
- **App Version**: Matches chart version
- **Description**: Kubernetes Operator for Kube9 Cluster Management
- **Home**: https://www.kube9.io
- **Sources**: https://charts.kube9.io

### Values Structure

The Helm chart supports comprehensive configuration through `values.yaml`:

#### Image Configuration
- `image.repository`: Container image repository (default: `ghcr.io/alto9/kube9-operator`)
- `image.tag`: Image tag (default: matches chart appVersion)
- `image.pullPolicy`: Image pull policy (default: `IfNotPresent`)

#### Resource Configuration
- `resources.requests.memory`: Memory request (default: `1Gi`)
- `resources.requests.cpu`: CPU request (default: `500m`)
- `resources.limits.memory`: Memory limit (default: `1Gi`)
- `resources.limits.cpu`: CPU limit (default: `500m`)
- Uses Guaranteed QoS (requests = limits) for stable performance

#### Service Account & RBAC
- `serviceAccount.create`: Create service account (default: `true`)
- `serviceAccount.name`: Service account name (default: `kube9-operator`)
- `rbac.create`: Create RBAC resources (default: `true`)

#### Operator Configuration
- `logLevel`: Log level (default: `info`; options: `debug`, `info`, `warn`, `error`)
- `statusUpdateIntervalSeconds`: Status update interval in seconds (default: `60`)
- Chart values configure logging, status interval, ArgoCD/Trivy options, collection intervals, and event retention (see `charts/kube9-operator/values.yaml`).

#### ArgoCD Integration
- `argocd.autoDetect`: Enable automatic ArgoCD detection (default: `true`)
- `argocd.enabled`: Explicitly enable/disable ArgoCD integration (optional)
- `argocd.namespace`: Custom namespace where ArgoCD is installed (default: `argocd`)
- `argocd.selector`: Custom label selector for ArgoCD server deployment (optional)
- `argocd.detectionInterval`: Detection check interval in hours (default: `6`)
- `argocd.api.collectionEnabled`: Schedule M9 Application status collection (default: `true`)
- `argocd.api.baseUrl`: Optional explicit HTTPS base URL for argocd-server
- `argocd.api.timeoutMs`: HTTP timeout for Argo CD API requests (default: `30000`)
- `argocd.api.tlsInsecure`: Skip TLS verification (default: `false`)
- `argocd.api.serverServiceName`: Service name for derived URL (default: `argocd-server`)
- `argocd.api.token.existingSecret`: Name of an existing Secret (release namespace) holding a dedicated Argo CD API bearer; empty/unset = default-off (no mount, no `ARGOCD_API_TOKEN_FILE`)
- `argocd.api.token.existingSecretKey`: Key within that Secret (default: `token`)
- When `argocd.api.token.existingSecret` is set, the Deployment mounts the Secret key at `/var/run/secrets/kube9/argocd-api-token` and sets `ARGOCD_API_TOKEN_FILE` to that path. Chart does not create a Secret from plaintext values.

#### Metrics Collection Intervals
- `metrics.intervals.clusterMetadata`: Cluster metadata collection interval in seconds (default: `86400` = 24 hours, minimum: `3600`)
- `metrics.intervals.resourceInventory`: Resource inventory collection interval in seconds (default: `21600` = 6 hours, minimum: `1800`)
- `metrics.intervals.resourceConfigurationPatterns`: Resource configuration patterns collection interval in seconds (default: `43200` = 12 hours, minimum: `3600`)
- `metrics.intervals.performanceMetrics`: Performance metrics collection interval in seconds (default: `900` = 15 minutes; enforced minimum locked with runtime)
- `metrics.intervals.securityPosture`: Security posture collection interval in seconds (default: `86400` = 24 hours; enforced minimum locked with runtime)

Chart `values.yaml` also carries intervals for Argo CD Application status and workload image scan under the same `metrics.intervals` map; those stay documented in the chart README.

#### Optional Prometheus (performance collector, outbound)

Performance metrics use an optional in-cluster Prometheus HTTP client (query and/or scrape). Packaging posture mirrors Trivy / Argo CD optional integrations:

- Default install stays **zero-ingress**. Prometheus integration is **outbound** cluster-internal traffic when configured or discovered.
- Chart must not install Prometheus, create a ServiceMonitor for kube9 ownership of Prometheus, or invent an inbound scrape surface for this collector.
- Chart must not create Secrets from plaintext credentials. If bearer/auth is ever required, use an existingSecret mount pattern (same class as `argocd.api.token.existingSecret`).
- Exact values-tree keys (`prometheus.*` vs `performanceMetrics.*`), discovery defaults, timeout/TLS knobs, and enable vs always-register wiring are open implementation decisions below (coordinate with runtime + integration).

#### Event Storage
- `events.persistence.enabled`: Enable persistent storage (default: `true`)
- `events.persistence.size`: PersistentVolume size (default: `5Gi`)
- `events.persistence.storageClassName`: Storage class name (default: `""` - uses cluster default)
- `events.persistence.accessMode`: Access mode (default: `ReadWriteOnce`)
- `events.retention.infoWarning`: Retention period for info/warning events in days (default: `7`)
- `events.retention.errorCritical`: Retention period for error/critical events in days (default: `30`)

**Advertised retention for agent / Desktop history consumers:** Chart defaults above are the product-visible event windows (info/warning **7** days, error/critical **30** days). Peer clients that cite Operator history must match this severity-split pair. There is no single unified day count in packaging. Overrides via Helm/env remain supported; changing defaults is out of scope for agent-debugging packaging.

**Packaging non-goals (agent-consumer path):**
- No Helm values, PVC sizing, or image packaging for operator **log** capture or failure-log retention
- No assessment-history TTL / prune knobs in the chart (assessments persist until explicit remove or cascade; data owns lifecycle)
- No collections TTL or count-cap knobs in the chart (SQLite `collections` rows persist until explicit remove / operational cleanup; same class as assessments). Operators should expect PVC growth under frequent append-only collectors (notably ~15m performance ticks); sizing stays an operational concern, not a product retention SLA.

#### Namespace
- **Default Namespace**: `kube9-system`
- Configurable via `--namespace` flag during Helm install

### Consumer retention narrative (chart README)

`charts/kube9-operator/README.md` under **Event Storage and Retention** documents the agent/Desktop consumer stance: severity-split defaults (**7** / **30** days), cleanup every **6 hours** via `RetentionCleanup`, Helm/env overrides of the effective store window, and that peers must not paraphrase a single “N days” default for evidence copy. kube9-desktop owns evidence-footer chip strings against this peer truth.

## Docker Image

### Image Details
- **Registry**: `ghcr.io/alto9/kube9-operator`
- **Build Process**: Multi-stage build via GitHub Actions when a version is released (image workflows run on GitHub Release / `v*` tags after maintainers run **[Cut Release](../../.github/workflows/cut-release.yml)** so semantic-release can publish that release)
- **Base Image**: `node:22-alpine` (Node.js 22 on Alpine Linux)

### Build Stages

#### Builder Stage
1. Uses `node:22-alpine` as base
2. Installs build dependencies: `python3`, `make`, `g++` (for native modules)
3. Copies `package*.json` and runs `npm ci` (installs all dependencies including dev)
4. Copies source code (`src/`, `tsconfig.json`)
5. Builds TypeScript with `npm run build`

#### Production Stage
1. Uses `node:22-alpine` as base
2. Installs runtime dependencies: `python3`, `make`, `g++` (for native modules)
3. Copies `package*.json` and runs `npm ci --omit=dev` (production dependencies only)
4. Copies built `dist/` folder from builder stage
5. Links binary globally with `npm link` (creates `/usr/local/bin/kube9-operator`)
6. Removes build dependencies to reduce image size
7. Creates `/data` directory with correct permissions (`chown node:node /data`)
8. Switches to non-root user (`USER node`, UID 1000)
9. Exposes port 8080 for health endpoints
10. Runs application with `node dist/index.js`

### Image Characteristics
- **User**: Non-root (`node` user, UID 1000)
- **Working Directory**: `/app`
- **Data Directory**: `/data` (for SQLite database)
- **Exposed Port**: 8080 (health endpoints)

## Chart Metadata

### Kubernetes Requirements
- **Minimum Kubernetes Version**: `>= 1.24.0`
- **API Version**: `v2` (Helm 3 chart format)

### Versioning
- Chart version follows SemVer
- App version matches chart version
- Chart versioning independent of operator binary version

## Open implementation decisions

- **Exact Helm interval keys and env mapping:** Lock camelCase under `metrics.intervals` (candidates above: `performanceMetrics`, `securityPosture`) and Deployment env names (candidates: `PERFORMANCE_METRICS_INTERVAL_SECONDS`, `SECURITY_POSTURE_INTERVAL_SECONDS`). Defaults stay in the ~900s / ~86400s class; enforced minima and random-offset seconds align with runtime config loader.
- **Prometheus values block shape:** Whether outbound client knobs live under `prometheus.*` (mirror `trivy.*` sibling) or nested under `performanceMetrics.*`; which of base URL, autoDetect/discovery, timeoutMs, tlsInsecure, and existingSecret auth are chart-first vs env-only; default-off until configured vs always-register collector with graceful degrade (must match runtime + integration).
- **Chart harness / README tables:** `test-helm-chart.sh` Phase 5 assertions and README value tables for new interval env keys, optional Prometheus knobs, and any status fields; consumer wording that performance needs optional Prometheus and security posture is cluster-API only.
