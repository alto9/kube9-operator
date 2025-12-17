---
story_id: create-image-publishing-workflow
session_id: self-contained-helm-chart-repository-infrastructur
feature_id:
  - container-image-publishing
spec_id:
  - container-image-automation
status: completed
---

# Create Docker Image Publishing GitHub Actions Workflow

## Objective

Create `.github/workflows/release-image.yml` workflow that builds multi-platform Docker images and publishes them to GitHub Container Registry (GHCR) on releases.

## Context

This workflow automatically builds and publishes Docker images when releases are created. It must support multi-platform builds (amd64 + arm64), use GitHub Actions cache, run security scanning with Trivy, and tag images appropriately.

## Files to Create

- `.github/workflows/release-image.yml`

## Implementation Steps

1. Create workflow with triggers:
   - release published
   - tags matching v* pattern
2. Configure job with permissions:
   - contents: read
   - packages: write
   - security-events: write
3. Configure steps:
   - Checkout code
   - Set up Docker Buildx
   - Log in to GHCR using GITHUB_TOKEN
   - Extract metadata (tags and labels) using docker/metadata-action
   - Build and push multi-platform image (linux/amd64, linux/arm64)
   - Use GitHub Actions cache (type=gha)
   - Add OCI labels for version, commit, source, etc.
   - Run Trivy vulnerability scanner
   - Upload Trivy results to GitHub Security tab
   - Output success message with pull instructions

## Acceptance Criteria

- [ ] Workflow triggers on release and v* tags
- [ ] Permissions configured correctly (packages: write, security-events: write)
- [ ] Docker Buildx setup configured
- [ ] GHCR login uses GITHUB_TOKEN
- [ ] Metadata extraction creates correct tags (version, major.minor, major, latest)
- [ ] Multi-platform build configured (amd64 + arm64)
- [ ] GitHub Actions cache configured (cache-from and cache-to)
- [ ] OCI labels include version, commit, source, description
- [ ] Trivy scanner runs with CRITICAL,HIGH severity
- [ ] SARIF results uploaded to GitHub Security
- [ ] Success output includes image pull command

## Estimated Time

< 30 minutes

