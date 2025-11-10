---
feature_group: kube9-operator-mvp
---

# kube9 Operator Features

## Background

```gherkin
Background:
  Given the kube9 operator is a Kubernetes controller running in Node.js 22
  And the operator is deployed via Helm chart
  And the operator runs in the kube9-system namespace
  And the operator can be installed with or without an API key
```

## Rules

```gherkin
Rule: Operator operates in one of two modes based on API key presence
  Example: Free tier (operated mode)
    Given the operator is installed without an API key
    Then the operator should run in "operated" mode
    And the operator should NOT communicate with kube9-server
    And the operator should expose status indicating free tier

  Example: Pro tier (enabled mode)
    Given the operator is installed with a valid API key
    Then the operator should run in "enabled" mode
    And the operator should register with kube9-server
    And the operator should expose status indicating pro tier

Rule: Operator must be discoverable by VS Code extension
  Example: Extension can detect operator presence
    Given the VS Code extension connects to a cluster
    When the extension checks for the operator
    Then it should be able to detect if the operator is installed
    And it should be able to query the operator's tier status

Rule: Operator must respect cluster security
  Example: No ingress required
    Given the operator needs to communicate with kube9-server
    When running in enabled mode
    Then the operator should push data outbound via HTTPS
    And the operator should NOT require any ingress or inbound connections
    And the operator should NOT expose cluster credentials outside the cluster

Rule: Operator installation must be simple
  Example: Standard Helm installation
    Given a cluster administrator wants to install the operator
    When they use the Helm chart
    Then the installation should follow standard Helm conventions
    And the chart should create the kube9-system namespace if needed
    And the chart should configure RBAC permissions appropriately
```

## MVP Scope

For the MVP, the operator focuses on:
1. **Status Exposure**: Providing tier status to the VS Code extension
2. **Simple Installation**: Easy Helm-based deployment
3. **Mode Detection**: Running in operated or enabled mode based on API key
4. **Server Registration**: Registering with kube9-server when in enabled mode

The MVP explicitly does NOT include:
- Metrics collection from cluster
- Data sanitization and processing
- Historical data storage
- Complex health checks or self-healing

