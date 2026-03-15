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
- `reregistrationIntervalHours`: Re-registration interval in hours (default: `24`)
- `serverUrl`: kube9-server URL for pro tier (default: `https://api.kube9.io`)

#### ArgoCD Integration
- `argocd.autoDetect`: Enable automatic ArgoCD detection (default: `true`)
- `argocd.enabled`: Explicitly enable/disable ArgoCD integration (optional)
- `argocd.namespace`: Custom namespace where ArgoCD is installed (default: `argocd`)
- `argocd.selector`: Custom label selector for ArgoCD server deployment (optional)
- `argocd.detectionInterval`: Detection check interval in hours (default: `6`)

#### Metrics Collection Intervals
- `metrics.intervals.clusterMetadata`: Cluster metadata collection interval in seconds (default: `86400` = 24 hours, minimum: `3600`)
- `metrics.intervals.resourceInventory`: Resource inventory collection interval in seconds (default: `21600` = 6 hours, minimum: `1800`)
- `metrics.intervals.resourceConfigurationPatterns`: Resource configuration patterns collection interval in seconds (default: `43200` = 12 hours, minimum: `3600`)

#### Event Storage
- `events.persistence.enabled`: Enable persistent storage (default: `true`)
- `events.persistence.size`: PersistentVolume size (default: `5Gi`)
- `events.persistence.storageClassName`: Storage class name (default: `""` - uses cluster default)
- `events.persistence.accessMode`: Access mode (default: `ReadWriteOnce`)
- `events.retention.infoWarning`: Retention period for info/warning events in days (default: `7`)
- `events.retention.errorCritical`: Retention period for error/critical events in days (default: `30`)

#### Namespace
- **Default Namespace**: `kube9-system`
- Configurable via `--namespace` flag during Helm install

## Docker Image

### Image Details
- **Registry**: `ghcr.io/alto9/kube9-operator`
- **Build Process**: Multi-stage build via GitHub Actions on release
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
