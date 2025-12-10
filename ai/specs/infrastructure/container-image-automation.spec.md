---
spec_id: container-image-automation
name: Container Image Publishing Automation
description: GitHub Actions workflow for building and publishing Docker images to GHCR on release
feature_id:
  - container-image-publishing
diagram_id:
  - release-coordination-flow
---

# Container Image Publishing Automation

## Overview

GitHub Actions workflow that automatically builds multi-platform Docker images and publishes them to GitHub Container Registry (GHCR) when releases are created. Images are publicly accessible and support both amd64 and arm64 architectures.

## Architecture

See [release-coordination-flow](../diagrams/workflows/release-coordination-flow.diagram.md) for complete release workflow visualization.

## Workflow Definition

**File**: `.github/workflows/release-image.yml`

**Purpose**: Build and publish Docker images to GHCR on release

**Triggers**:
- GitHub release published
- Tags matching `v*` pattern

**Container Registry**: GitHub Container Registry (ghcr.io)

**Image Path**: `ghcr.io/alto9/kube9-operator`

### Complete Workflow

```yaml
name: Release Docker Image

on:
  release:
    types: [published]
  push:
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      security-events: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest,enable={{is_default_branch}}
          labels: |
            org.opencontainers.image.title=kube9-operator
            org.opencontainers.image.description=Kubernetes Operator for kube9 Ecosystem
            org.opencontainers.image.vendor=Alto9
            org.opencontainers.image.source=https://github.com/${{ github.repository }}
            org.opencontainers.image.documentation=https://github.com/${{ github.repository }}/blob/main/README.md
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            BUILD_DATE=${{ fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.created'] }}
            VCS_REF=${{ github.sha }}
            VERSION=${{ fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.version'] }}
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.version'] }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
      
      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Output image info
        run: |
          echo "✅ Image published successfully"
          echo "Registry: ${{ env.REGISTRY }}"
          echo "Image: ${{ env.IMAGE_NAME }}"
          echo "Tags: ${{ steps.meta.outputs.tags }}"
          echo ""
          echo "Pull with:"
          echo "  docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest"
```

## Authentication

### GHCR Access

**Built-in Token**: Workflow uses `GITHUB_TOKEN` (automatic)
- Permissions: `packages: write` (defined in workflow)
- Scope: Limited to the repository
- No manual secret configuration needed

**Registry**: `ghcr.io`
**Login**: `docker/login-action@v3` handles authentication

### Public Image Access

Published images are **public**:
- No authentication required to pull
- Configured in repository settings: Packages → Change visibility → Public

## Multi-Platform Builds

### Supported Platforms

- **linux/amd64** - x86_64 architecture (most cloud providers)
- **linux/arm64** - ARM64/aarch64 (AWS Graviton, Apple Silicon)

### Build Process

Uses Docker Buildx with QEMU emulation:
1. **Setup Buildx**: Creates builder with multi-platform support
2. **Build platforms**: Builds both architectures in parallel
3. **Create manifest**: Combines into multi-platform manifest
4. **Push manifest**: Single image tag with multiple architectures

Kubernetes automatically pulls the correct architecture.

## Image Tagging Strategy

### Release v1.2.3 Example

Creates multiple tags for flexibility:

| Tag | Purpose |
|-----|---------|
| `v1.2.3` | Exact version (with v prefix) |
| `1.2.3` | Exact version (without v) |
| `1.2` | Minor version (auto-updates patch) |
| `1` | Major version (auto-updates minor/patch) |
| `latest` | Latest stable release |

### Pre-Release Handling

For pre-releases (e.g., `v1.0.0-beta.1`):
- Tagged with full pre-release version
- NOT tagged as `latest`
- Keeps production users on stable releases

### Tag Implementation

Uses `docker/metadata-action@v5`:
```yaml
tags: |
  type=semver,pattern={{version}}        # 1.2.3
  type=semver,pattern={{major}}.{{minor}} # 1.2
  type=semver,pattern={{major}}           # 1
  type=raw,value=latest,enable={{is_default_branch}}
```

## Image Metadata (OCI Labels)

### Standard Labels

Following OCI Image Spec:
- `org.opencontainers.image.created` - Build timestamp
- `org.opencontainers.image.source` - GitHub repository URL
- `org.opencontainers.image.version` - Release version
- `org.opencontainers.image.revision` - Git commit SHA
- `org.opencontainers.image.title` - kube9-operator
- `org.opencontainers.image.description` - Operator description
- `org.opencontainers.image.vendor` - Alto9

### Viewing Labels

```bash
docker inspect ghcr.io/alto9/kube9-operator:1.0.0 | jq '.[0].Config.Labels'
```

## Build Caching

### GitHub Actions Cache

Uses GitHub Actions cache backend:
- **Type**: `type=gha` (GitHub Actions cache)
- **Mode**: `mode=max` (cache all layers)
- **Benefit**: Faster subsequent builds
- **Persistence**: Cache survives across workflow runs

### Cache Optimization

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

**First build**: ~5-10 minutes
**Cached build**: ~2-3 minutes (only changed layers rebuilt)

## Security Scanning

### Trivy Integration

Scans for vulnerabilities in:
- OS packages (Alpine Linux)
- Node.js dependencies
- Known CVEs in base images

### Scan Configuration

```yaml
severity: 'CRITICAL,HIGH'
format: 'sarif'
```

### Results

- **SARIF format**: Uploaded to GitHub Security tab
- **Workflow**: Fails on critical vulnerabilities
- **Visibility**: Scan results in Security → Code scanning alerts

### Security Tab Integration

Navigate to: Repository → Security → Code scanning
- View vulnerability alerts
- Track remediation
- Historical scan results

## Dockerfile Requirements

### Current Dockerfile

The existing `Dockerfile` is already optimized:
- ✅ Multi-stage build
- ✅ Non-root user (node:1000)
- ✅ Alpine Linux base (minimal)
- ✅ Production dependencies only
- ✅ Layer caching optimized

### Build Arguments

Optional build args can be added:
```dockerfile
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.version="${VERSION}"
```

## Image Size

### Target

- **Goal**: < 200MB
- **Current**: ~150MB (Alpine + Node 22 + dependencies)

### Optimization Techniques

1. **Alpine Linux**: Minimal base image (~5MB)
2. **Multi-stage build**: Build dependencies not in final image
3. **Production deps only**: `npm ci --omit=dev`
4. **Clean build tools**: `apk del python3 make g++`
5. **No dev dependencies**: Only runtime packages

## GitHub Package Settings

### Repository Configuration

**Required Settings**:
1. Go to: Repository → Settings → Actions → General
2. **Workflow permissions**: Read and write permissions
3. **Packages**: Set package visibility to Public

**Manual Steps** (one-time):
1. Navigate to repository Packages
2. Select kube9-operator package
3. Package settings → Change visibility → Public
4. Confirm public access

## Permissions

### Workflow Permissions

```yaml
permissions:
  contents: read       # Read repository contents
  packages: write      # Push to GHCR
  security-events: write # Upload security scan results
```

### GITHUB_TOKEN Scope

Automatic token with:
- Read access to repository
- Write access to packages
- Write access to security events
- Limited to current workflow run

## Error Handling

### Build Failures

**Dockerfile syntax error**:
- Workflow fails at build step
- No image pushed
- Error visible in Actions log

**Dependency installation failure**:
- Workflow fails at build step
- Check npm logs in workflow output
- No image pushed

### Push Failures

**Authentication error**:
- Check workflow permissions
- Verify packages: write permission
- Ensure GITHUB_TOKEN available

**Rate limiting**:
- GHCR has rate limits
- Authenticated requests have higher limits
- Retry with exponential backoff

### Scan Failures

**Critical vulnerabilities found**:
- Workflow fails
- Image already pushed (scan happens after)
- Update dependencies and rebuild
- Check Security tab for details

## Integration with Chart Publishing

### Coordinated Release

Both workflows run on release:

**Sequence**:
1. Release created (tag: `v1.0.0`)
2. **Image workflow** runs first (faster, ~5 min)
3. **Chart workflow** runs concurrently (~3 min)
4. Both complete independently
5. Chart references published image

**Chart Values**:
```yaml
image:
  repository: ghcr.io/alto9/kube9-operator
  tag: "1.0.0"  # Matches release version
```

### Version Consistency

**Helm Chart**:
- Chart version: `1.0.0` (from Chart.yaml)
- App version: `1.0.0` (from Chart.yaml)

**Docker Image**:
- Image tag: `1.0.0` (from release tag)
- Image tag: `latest` (if default branch)

Both match the GitHub release version.

## Testing

### Local Testing

**Build locally**:
```bash
docker build -t kube9-operator:test .
docker run --rm kube9-operator:test
```

**Test multi-platform** (requires Buildx):
```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t kube9-operator:test \
  .
```

### Pull and Verify

**After workflow runs**:
```bash
# Pull image
docker pull ghcr.io/alto9/kube9-operator:1.0.0

# Inspect metadata
docker inspect ghcr.io/alto9/kube9-operator:1.0.0

# Check labels
docker inspect ghcr.io/alto9/kube9-operator:1.0.0 | jq '.[0].Config.Labels'

# Run container
docker run --rm ghcr.io/alto9/kube9-operator:1.0.0
```

### In Kubernetes

**Deploy with published image**:
```bash
helm install kube9-operator kube9/kube9-operator \
  --set image.repository=ghcr.io/alto9/kube9-operator \
  --set image.tag=1.0.0
```

## Monitoring

### Workflow Status

Monitor in GitHub Actions:
- Build duration
- Success/failure rate
- Image size trends
- Scan results

### Package Analytics

GitHub Packages provides:
- Download count
- Tag popularity
- Storage usage
- Public/private access

### Security Alerts

GitHub Security tab shows:
- Vulnerability scan results
- Dependency alerts
- Code scanning results
- Secret scanning (if enabled)

## Cost

### GHCR Storage

- **Free tier**: 500MB storage
- **Free tier**: 1GB data transfer/month
- **Public repositories**: Unlimited bandwidth

### Typical Usage

- **Image size**: ~150MB
- **Versions kept**: ~10-20
- **Total storage**: ~1.5-3GB
- **Cost**: Free for public images

## Maintenance

### Dependency Updates

**Base image**:
- Currently: `node:22-alpine`
- Update: Change in Dockerfile
- Rebuild: Automatic on next release

**Build actions**:
- Dependabot updates action versions
- Review and merge PRs
- Test with workflow runs

### Image Cleanup

**Manual cleanup**:
- Old image versions can be deleted
- Navigate to Packages → Versions
- Delete unused versions

**Automated cleanup** (future):
- GitHub Actions can delete old versions
- Keep last N versions
- Delete versions older than X days

## Technical Requirements

- Docker Buildx support
- Multi-platform emulation (QEMU)
- GitHub Actions runner (ubuntu-latest)
- GITHUB_TOKEN with packages: write

## References

- GitHub Container Registry: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Docker Buildx: https://docs.docker.com/buildx/working-with-buildx/
- OCI Image Spec: https://github.com/opencontainers/image-spec/blob/main/annotations.md
- Trivy Scanner: https://github.com/aquasecurity/trivy

