---
session_id: self-contained-helm-chart-repository-infrastructur
start_time: '2025-12-10T01:32:30.766Z'
status: completed
problem_statement: Self-Contained Helm Chart Repository Infrastructure
changed_files:
  - path: ai/features/deployment/chart-repository-hosting.feature.md
    change_type: added
    scenarios_added:
      - Infrastructure deployed for chart hosting
      - Chart published on release
      - User adds Helm repository
      - User installs chart from repository
      - Multiple chart versions available
      - Automatic index.yaml merging
      - CloudFront cache invalidation
      - Infrastructure independent of portal
      - Infrastructure deployment failure handling
      - Chart publishing without infrastructure changes
      - Public access without authentication
      - Repository URL consistency
      - CDN global distribution
  - path: ai/features/deployment/container-image-publishing.feature.md
    change_type: added
    scenarios_added:
      - Image built and pushed on release
      - Multi-platform image builds
      - Image tagging strategy
      - GHCR authentication
      - Image visibility
      - Image build caching
      - Build failure handling
      - Image metadata
      - Security scanning
      - Image size optimization
      - Helm chart references published image
      - Coordinated release workflow
      - Pre-release image publishing
      - Image pull by Kubernetes
      - Build reproducibility
start_commit: d901d9ae794380a571d926d917c023e01c982c76
end_time: '2025-12-10T01:44:32.884Z'
---
## Problem Statement

Create self-contained infrastructure for both Docker image and Helm chart distribution. Images should be published to GitHub Container Registry (GHCR), and charts should be hosted at `https://charts.kube9.io` using S3 + CloudFront. Both should be automatically published on releases with no manual intervention.

## Goals

1. **Self-Contained Infrastructure**: All distribution infrastructure managed within kube9-operator repository
2. **Automated Publishing**: Both images and charts automatically published on GitHub releases without manual intervention
3. **Public Access**: No authentication required for users to pull images or access charts
4. **Standard Patterns**: GHCR for images, traditional Helm repository for charts (not OCI/ECR)
5. **Global Distribution**: GHCR CDN for images, CloudFront CDN for charts
6. **Version Consistency**: Image tags and chart versions match release versions

## Approach

### Docker Images (GHCR)

Use GitHub Container Registry for image hosting:
- Public images at `ghcr.io/alto9/kube9-operator`
- No additional infrastructure needed
- Free for public repositories
- Built-in GITHUB_TOKEN authentication for publishing

### Helm Charts (AWS CDK)

Create a CDK stack in `infrastructure/` directory that provisions:
- S3 bucket for chart storage
- CloudFront distribution with custom domain (`charts.kube9.io`)
- Route53 A record for DNS
- Origin Access Control for secure S3 access

### Automation (GitHub Actions)

Three independent workflows:

1. **Infrastructure Deployment** (`.github/workflows/deploy-infrastructure.yml`)
   - Deploys CDK stack to AWS for chart hosting
   - Triggered manually or on infrastructure changes
   - One-time setup with occasional updates

2. **Image Publishing** (`.github/workflows/release-image.yml`)
   - Builds multi-platform Docker images (amd64 + arm64)
   - Pushes to GitHub Container Registry
   - Runs security scanning with Trivy
   - Triggered automatically on GitHub releases

3. **Chart Publishing** (`.github/workflows/release-chart.yml`)
   - Packages and publishes charts to S3
   - Updates index.yaml and invalidates CloudFront cache
   - Triggered automatically on GitHub releases

### User Experience

Standard Docker and Helm commands work without modification:
```bash
# Pull image (Kubernetes does this automatically)
docker pull ghcr.io/alto9/kube9-operator:1.0.0

# Add Helm repository and install
helm repo add kube9 https://charts.kube9.io
helm install kube9-operator kube9/kube9-operator
```

## Key Decisions

1. **GHCR for Images**: Chose GitHub Container Registry because:
   - Free for public repositories
   - Native GitHub integration
   - No additional infrastructure needed
   - Standard practice for open-source projects
   - Automatic GITHUB_TOKEN authentication

2. **S3 + CloudFront for Charts (not ECR OCI)**: Chose S3 + CloudFront because:
   - Custom domain support (`charts.kube9.io`)
   - No authentication required
   - Traditional Helm repository pattern
   - All Helm versions supported
   - Separate concerns: images in GHCR, charts in S3

3. **Self-Contained vs Portal-Managed**: Infrastructure in operator repo because:
   - Clear ownership and lifecycle management
   - No cross-repo dependencies
   - Operator controls its own distribution
   - Independent deployment and updates

4. **CDK vs Other IaC**: AWS CDK chosen for charts infrastructure:
   - Type-safe infrastructure definitions
   - Familiar TypeScript tooling (Node 22)
   - Excellent CloudFormation integration
   - Matches existing tech stack

5. **GitHub Actions vs Other CI**: GitHub Actions because:
   - Native integration with releases
   - No additional services needed
   - Easy secret management
   - Free for public repositories
   - Built-in GITHUB_TOKEN for GHCR

6. **Multi-Platform Images**: Build for both amd64 and arm64:
   - Supports standard cloud providers (amd64)
   - Supports AWS Graviton and Apple Silicon (arm64)
   - Docker Buildx handles platform emulation
   - Kubernetes pulls correct architecture automatically

7. **Security Scanning**: Integrate Trivy scanning:
   - Catch vulnerabilities before deployment
   - Upload results to GitHub Security tab
   - Fail builds on critical vulnerabilities
   - Automated security compliance

8. **Cache Strategy**:
   - Docker layers: GitHub Actions cache (faster builds)
   - Chart packages: 1 year (immutable, versioned)
   - index.yaml: 5 minutes (frequently updated)
   - CloudFront edge caching for global speed

## Notes

### Prerequisites

- ACM certificate for `*.kube9.io` in us-east-1 region
- Route53 hosted zone for `kube9.io` domain
- AWS credentials with S3, CloudFront, Route53 permissions
- GitHub repository secrets configured

### GitHub Issue

Feature request created: https://github.com/alto9/kube9-operator/issues/3

### Related Documentation

- Chart spec: `ai/specs/deployment/helm-chart-spec.spec.md`
- Helm context: `ai/contexts/development/helm-chart-development.context.md`
- Architecture docs reference `charts.kube9.io` but infrastructure doesn't exist yet

### Next Steps After Design Session

1. End this design session (status → scribe)
2. Distill into implementation stories
3. Implement CDK infrastructure stack
4. Create GitHub Actions workflows
5. Configure required secrets
6. Deploy infrastructure
7. Test with a release
8. Update documentation
