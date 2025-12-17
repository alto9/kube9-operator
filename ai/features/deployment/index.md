---
folder_id: deployment-features
name: Deployment Features
description: Features related to operator deployment, distribution, and installation
---

# Deployment Features

## Background

```gherkin
Background: Operator Distribution
  Given the kube9-operator is built and tested
  And users need to install the operator in their clusters
  And the operator follows standard Kubernetes patterns
  When distributing the operator
  Then Docker images should be published to a container registry
  And Helm charts should be hosted in a public repository
  And both should be automatically published on releases
  And installation should require no authentication for public access
```

## Rules

```gherkin
Rule: Public Access
  Given users installing the operator
  When accessing container images or Helm charts
  Then no authentication should be required
  And no AWS credentials should be needed
  And standard Docker/Helm commands should work without modification
  And both images and charts should be globally accessible

Rule: Automated Publishing
  Given a new operator release
  When the release is created in GitHub
  Then Docker images should be built and pushed to GHCR
  And Helm charts should be packaged and published to S3
  And both workflows should run automatically
  And no manual intervention should be required
  And version consistency should be maintained

Rule: Infrastructure Independence
  Given multiple Alto9 repositories
  When managing distribution infrastructure
  Then each repository should manage its own infrastructure
  And the operator should not depend on kube9-portal infrastructure
  And Docker images should use GitHub Container Registry
  And Helm charts should use self-contained AWS infrastructure
  And all infrastructure should be deployable independently

Rule: Version Consistency
  Given a release version (e.g., v1.0.0)
  When publishing artifacts
  Then Docker image tags should match the release version
  And Helm chart versions should match the release version
  And chart app version should reference the correct image tag
  And users should get matching versions when installing
```

