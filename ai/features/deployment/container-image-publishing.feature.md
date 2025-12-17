---
feature_id: container-image-publishing
name: Container Image Publishing
description: Automated building and publishing of Docker images to GitHub Container Registry (GHCR) on release
spec_id:
  - container-image-automation
---

# Container Image Publishing

```gherkin
Scenario: Image built and pushed on release
  Given a new release is created in kube9-operator repository
  When the release-image workflow triggers
  Then the Docker image should be built from the Dockerfile
  And the image should be tagged with the release version
  And the image should be tagged as latest
  And both tags should be pushed to ghcr.io/alto9/kube9-operator
  And the push should succeed without manual intervention

Scenario: Multi-platform image builds
  Given the Docker image is being built
  When building for production release
  Then the image should be built for linux/amd64 platform
  And the image should be built for linux/arm64 platform
  And both architectures should be pushed as a multi-platform manifest
  And Kubernetes can pull the correct architecture automatically

Scenario: Image tagging strategy
  Given a release v1.2.3 is created
  When the image is built
  Then it should be tagged as ghcr.io/alto9/kube9-operator:v1.2.3
  And it should be tagged as ghcr.io/alto9/kube9-operator:1.2.3
  And it should be tagged as ghcr.io/alto9/kube9-operator:1.2
  And it should be tagged as ghcr.io/alto9/kube9-operator:1
  And it should be tagged as ghcr.io/alto9/kube9-operator:latest

Scenario: GHCR authentication
  Given the GitHub Actions workflow
  When authenticating to GHCR
  Then it should use the built-in GITHUB_TOKEN
  And no additional secrets should be required
  And authentication should succeed automatically

Scenario: Image visibility
  Given images are published to GHCR
  When a user attempts to pull the image
  Then the image should be publicly accessible
  And no authentication should be required for pulling
  And the image should be listed in the repository packages

Scenario: Image build caching
  Given previous image builds exist
  When building a new image
  Then Docker layer caching should be used
  And GitHub Actions cache should store layers
  And subsequent builds should be faster
  And cache should persist between workflow runs

Scenario: Build failure handling
  Given the Docker build process
  When the build fails
  Then the workflow should fail immediately
  And no image should be pushed to GHCR
  And the error should be clearly visible in Actions logs
  And the release should remain without a published image

Scenario: Image metadata
  Given an image is published
  When inspecting the image
  Then it should include OCI labels for version
  And it should include labels for git commit SHA
  And it should include labels for build timestamp
  And it should include labels for source repository URL
  And metadata should be accessible via docker inspect

Scenario: Security scanning
  Given an image is built
  When the build completes
  Then the image should be scanned for vulnerabilities
  And critical vulnerabilities should fail the workflow
  And scan results should be visible in GitHub Security tab
  And developers should be notified of issues

Scenario: Image size optimization
  Given the Dockerfile uses multi-stage builds
  When the production image is built
  Then only production dependencies should be included
  And build tools should be removed
  And the image size should be minimal
  And the image should be under 200MB

Scenario: Helm chart references published image
  Given a chart version is published
  And a corresponding image version exists
  When a user installs the chart
  Then the chart should reference the correct GHCR image
  And the image tag should match the chart version
  And Kubernetes should successfully pull the image from GHCR

Scenario: Coordinated release workflow
  Given a new release is created
  When both image and chart workflows run
  Then the image should be built and pushed first
  And the chart should be published after image is available
  And chart deployment should reference the newly published image
  And users installing from the chart should get the correct image version

Scenario: Pre-release image publishing
  Given a pre-release (e.g., v1.0.0-beta.1) is created
  When the image workflow runs
  Then the image should be tagged with the pre-release version
  And it should NOT be tagged as latest
  And the pre-release image should be available for testing
  And production users remain unaffected

Scenario: Image pull by Kubernetes
  Given an image is published to GHCR
  When a Kubernetes cluster pulls the image
  Then the pull should succeed without authentication
  And the image should work on both amd64 and arm64 nodes
  And the correct platform variant should be pulled automatically
  And image pull policy should respect Helm values

Scenario: Build reproducibility
  Given a specific git commit
  When building the image multiple times
  Then the image should be reproducible
  And the image digest should be consistent
  And layer caching should produce identical results
  And the git commit should be traceable from the image
```

