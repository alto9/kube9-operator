# Deployment Environments

## Chart Hosting

### Repository Infrastructure
- **Domain**: `charts.kube9.io`
- **Hosting**: Amazon S3 + CloudFront CDN
- **CDK Stack**: Located in `infrastructure/` directory
- **Index File**: Automated `index.yaml` generation on release
- **Chart Storage**: Helm charts stored in S3 bucket, served via CloudFront

### Chart Distribution
- Charts are automatically published to the repository on release
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
- **Trigger**: Automated builds on release via GitHub Actions
- **Multi-Platform**: Supports multiple architectures (amd64, arm64)
- **Tagging Strategy**: 
  - Release tags match semantic version (e.g., `1.3.0`)
  - `latest` tag points to most recent release
- **Image Manifest**: Multi-arch manifests for cross-platform support

### Image Lifecycle
- Images are built and pushed automatically on release
- Old images are retained for rollback purposes
- Image tags match Git release tags

## Local Development

### Minikube Deployment
- **Command**: `npm run deploy:minikube`
- **Purpose**: Local development and testing environment
- **Process**: 
  1. Builds Docker image locally
  2. Loads image into Minikube
  3. Deploys Helm chart with development overrides

### Development Configuration
- Helm values can be overridden for local development
- Dev server URL can be configured via values override
- Local image builds use development tags
- Supports hot-reload and debugging configurations

### Development Workflow
1. Make code changes
2. Build Docker image locally
3. Load into Minikube: `minikube image load ghcr.io/alto9/kube9-operator:dev`
4. Deploy with Helm: `helm upgrade --install kube9-operator ./charts/kube9-operator -f dev-values.yaml`
5. Test operator functionality
6. Iterate on changes

### Environment Variables
- Development can override default values via Helm values
- Local testing can use different database paths
- Debug logging enabled via `logLevel: debug`
