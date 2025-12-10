---
diagram_id: release-coordination-flow
name: Release Coordination Flow
description: Complete release workflow showing coordinated Docker image and Helm chart publishing
type: flows
spec_id:
  - container-image-automation
  - chart-publishing-automation
feature_id:
  - container-image-publishing
  - chart-repository-hosting
---

# Release Coordination Flow

This diagram shows how Docker image publishing and Helm chart publishing work together in a coordinated release.

```json
{
  "nodes": [
    {
      "id": "release",
      "type": "default",
      "position": { "x": 400, "y": 50 },
      "data": {
        "label": "GitHub Release",
        "description": "Create release v1.0.0"
      }
    },
    {
      "id": "trigger-image",
      "type": "default",
      "position": { "x": 200, "y": 150 },
      "data": {
        "label": "Image Workflow",
        "description": "release-image.yml triggers"
      }
    },
    {
      "id": "trigger-chart",
      "type": "default",
      "position": { "x": 600, "y": 150 },
      "data": {
        "label": "Chart Workflow",
        "description": "release-chart.yml triggers"
      }
    },
    {
      "id": "build-image",
      "type": "default",
      "position": { "x": 200, "y": 250 },
      "data": {
        "label": "Build Docker Image",
        "description": "Multi-platform: amd64 + arm64"
      }
    },
    {
      "id": "scan-image",
      "type": "default",
      "position": { "x": 200, "y": 350 },
      "data": {
        "label": "Security Scan",
        "description": "Trivy vulnerability scan"
      }
    },
    {
      "id": "push-ghcr",
      "type": "default",
      "position": { "x": 200, "y": 450 },
      "data": {
        "label": "Push to GHCR",
        "description": "ghcr.io/alto9/kube9-operator:1.0.0"
      }
    },
    {
      "id": "package-chart",
      "type": "default",
      "position": { "x": 600, "y": 250 },
      "data": {
        "label": "Package Chart",
        "description": "helm package → .tgz"
      }
    },
    {
      "id": "update-index",
      "type": "default",
      "position": { "x": 600, "y": 350 },
      "data": {
        "label": "Update Index",
        "description": "Merge into index.yaml"
      }
    },
    {
      "id": "upload-s3",
      "type": "default",
      "position": { "x": 600, "y": 450 },
      "data": {
        "label": "Upload to S3",
        "description": "Chart + index.yaml"
      }
    },
    {
      "id": "invalidate-cdn",
      "type": "default",
      "position": { "x": 600, "y": 550 },
      "data": {
        "label": "Invalidate CDN",
        "description": "CloudFront cache clear"
      }
    },
    {
      "id": "ghcr",
      "type": "default",
      "position": { "x": 200, "y": 650 },
      "data": {
        "label": "GHCR Registry",
        "description": "Docker images available"
      }
    },
    {
      "id": "s3-cloudfront",
      "type": "default",
      "position": { "x": 600, "y": 650 },
      "data": {
        "label": "charts.kube9.io",
        "description": "Helm charts available"
      }
    },
    {
      "id": "user-install",
      "type": "default",
      "position": { "x": 400, "y": 800 },
      "data": {
        "label": "User Installation",
        "description": "helm install kube9-operator"
      }
    },
    {
      "id": "k8s-pull",
      "type": "default",
      "position": { "x": 400, "y": 900 },
      "data": {
        "label": "Kubernetes",
        "description": "Pulls image from GHCR"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "release",
      "target": "trigger-image",
      "label": "triggers (concurrent)",
      "type": "smoothstep"
    },
    {
      "id": "e2",
      "source": "release",
      "target": "trigger-chart",
      "label": "triggers (concurrent)",
      "type": "smoothstep"
    },
    {
      "id": "e3",
      "source": "trigger-image",
      "target": "build-image",
      "label": "step 1",
      "type": "smoothstep"
    },
    {
      "id": "e4",
      "source": "build-image",
      "target": "scan-image",
      "label": "step 2",
      "type": "smoothstep"
    },
    {
      "id": "e5",
      "source": "scan-image",
      "target": "push-ghcr",
      "label": "step 3",
      "type": "smoothstep"
    },
    {
      "id": "e6",
      "source": "push-ghcr",
      "target": "ghcr",
      "label": "published",
      "type": "smoothstep"
    },
    {
      "id": "e7",
      "source": "trigger-chart",
      "target": "package-chart",
      "label": "step 1",
      "type": "smoothstep"
    },
    {
      "id": "e8",
      "source": "package-chart",
      "target": "update-index",
      "label": "step 2",
      "type": "smoothstep"
    },
    {
      "id": "e9",
      "source": "update-index",
      "target": "upload-s3",
      "label": "step 3",
      "type": "smoothstep"
    },
    {
      "id": "e10",
      "source": "upload-s3",
      "target": "invalidate-cdn",
      "label": "step 4",
      "type": "smoothstep"
    },
    {
      "id": "e11",
      "source": "invalidate-cdn",
      "target": "s3-cloudfront",
      "label": "published",
      "type": "smoothstep"
    },
    {
      "id": "e12",
      "source": "s3-cloudfront",
      "target": "user-install",
      "label": "helm repo add",
      "type": "smoothstep"
    },
    {
      "id": "e13",
      "source": "ghcr",
      "target": "k8s-pull",
      "label": "image reference",
      "type": "smoothstep"
    },
    {
      "id": "e14",
      "source": "user-install",
      "target": "k8s-pull",
      "label": "installs operator",
      "type": "smoothstep"
    }
  ]
}
```

## Release Coordination

### Parallel Execution

Both workflows run **concurrently** when a release is created:

**Advantages**:
- Faster total release time
- Independent failure isolation
- No sequential dependencies

**Timing**:
- Image workflow: ~5 minutes (build + scan + push)
- Chart workflow: ~3 minutes (package + upload)
- Total: ~5 minutes (parallel execution)

### Version Consistency

Release tag `v1.0.0` produces:

**Docker Image**:
- `ghcr.io/alto9/kube9-operator:v1.0.0`
- `ghcr.io/alto9/kube9-operator:1.0.0`
- `ghcr.io/alto9/kube9-operator:latest`

**Helm Chart**:
- Chart version: `1.0.0` (in Chart.yaml)
- App version: `1.0.0` (in Chart.yaml)
- File: `kube9-operator-1.0.0.tgz`

Both reference the same release version.

### Chart References Image

The Helm chart's `values.yaml` already points to GHCR:

```yaml
image:
  repository: ghcr.io/alto9/kube9-operator
  tag: "1.0.0"
```

When users install the chart:
1. Helm downloads chart from `charts.kube9.io`
2. Chart specifies image: `ghcr.io/alto9/kube9-operator:1.0.0`
3. Kubernetes pulls image from GHCR
4. Operator starts running

## Workflow Coordination

### No Hard Dependencies

Workflows are **independent**:
- Chart can succeed even if image fails
- Image can succeed even if chart fails
- Both publish to separate systems

### Best Practice

While independent, the image should be available before users install:
- Image workflow is faster (completes first)
- Chart workflow completes second
- By the time chart is available, image already exists
- Users always have matching versions

### Failure Scenarios

**Image fails, chart succeeds**:
- Chart is published
- Users can add chart repo
- Installation fails (image not found)
- Fix image issue and re-release

**Chart fails, image succeeds**:
- Image is published
- Chart not available in repo
- Users can pull image directly
- Fix chart issue and re-release

**Both fail**:
- Release exists but nothing published
- Fix issues and re-release

## User Experience Flow

### 1. Discovery

User finds kube9-operator:
- GitHub repository
- Documentation site
- README installation instructions

### 2. Add Helm Repository

```bash
helm repo add kube9 https://charts.kube9.io
helm repo update
```

Downloads `index.yaml` from CloudFront.

### 3. Search Charts

```bash
helm search repo kube9
```

Shows available charts and versions.

### 4. Install Operator

```bash
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
```

Helm:
- Downloads chart from `charts.kube9.io` (S3 + CloudFront)
- Reads chart values (includes GHCR image reference)
- Creates Kubernetes resources

### 5. Kubernetes Pulls Image

Kubernetes:
- Reads Deployment spec from chart
- Sees image: `ghcr.io/alto9/kube9-operator:1.0.0`
- Pulls image from GHCR (no auth required)
- Starts operator pod

### 6. Operator Runs

Operator:
- Starts in cluster
- Connects to Kubernetes API
- Begins monitoring and status reporting
- User's cluster is now "operated"

## Release Checklist

### Pre-Release

- [ ] Code merged to main
- [ ] Tests passing
- [ ] Version updated in Chart.yaml
- [ ] CHANGELOG updated
- [ ] Documentation updated

### Create Release

- [ ] Tag release: `git tag v1.0.0`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Create GitHub release from tag
- [ ] Add release notes

### Automatic (Workflows)

- [x] Image workflow builds and pushes to GHCR
- [x] Chart workflow packages and uploads to S3
- [x] Security scan runs
- [x] Both workflows complete successfully

### Post-Release Verification

- [ ] Check image in GHCR: `docker pull ghcr.io/alto9/kube9-operator:1.0.0`
- [ ] Check chart: `helm repo update && helm search repo kube9`
- [ ] Test installation: `helm install kube9-operator kube9/kube9-operator`
- [ ] Verify operator running: `kubectl get pods -n kube9-system`
- [ ] Check GitHub Security tab for scan results
- [ ] Update documentation with new version

## Monitoring

### GitHub Actions

Monitor both workflows:
- **release-image.yml**: Image build/push status
- **release-chart.yml**: Chart package/upload status

### Artifacts

Both workflows produce artifacts:
- **Image**: Visible in GitHub Packages
- **Chart**: Downloadable via Helm
- **Security scans**: GitHub Security tab

### Metrics

Track over time:
- Release frequency
- Workflow success rate
- Build duration
- Image size trends
- Download counts (GHCR + charts)

## Cost Summary

### Total Infrastructure Costs

| Component | Service | Cost |
|-----------|---------|------|
| **Docker Images** | GitHub Container Registry | Free (public) |
| **Helm Charts** | S3 + CloudFront + Route53 | ~$5-20/month |
| **CI/CD** | GitHub Actions | Free (public repo) |
| **DNS** | Route53 Hosted Zone | $0.50/month (shared) |
| **Certificate** | AWS ACM | Free |

**Estimated total**: $5-20/month for complete distribution infrastructure

### Scaling

As usage grows:
- GHCR: Free for public images (unlimited bandwidth)
- CloudFront: Pay for data transfer ($0.085/GB)
- S3: Negligible (charts are small)
- GitHub Actions: Free for public repos

## Technical Architecture

### Separation of Concerns

- **Source Code**: GitHub repository
- **Container Images**: GHCR (ghcr.io)
- **Helm Charts**: S3 + CloudFront (charts.kube9.io)
- **CI/CD**: GitHub Actions

Each component can be managed independently.

### Benefits

1. **Standard patterns**: GHCR for images, HTTP for charts
2. **No authentication**: Public access for both
3. **Global distribution**: CDN for both (GHCR + CloudFront)
4. **Cost effective**: Free images, cheap charts
5. **Fully automated**: Zero manual steps

