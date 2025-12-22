---
feature_id: status-exposure
spec_id: [status-api-spec]
context_id: [kubernetes-operator-development]
---

# Status Exposure Feature

## Overview

The operator must expose its tier status so that the kube9 VS Code extension can determine whether the cluster is in free tier (operated) or pro tier (enabled) mode.

## Behavior

```gherkin
Feature: Status Exposure

Background:
  Given the kube9 operator is running in a Kubernetes cluster
  And the operator is accessible via Kubernetes API

Scenario: Extension queries operator status in free tier
  Given the operator is installed without an API key
  And the operator is running in "operated" mode
  When the VS Code extension queries the operator status
  Then the operator should return status "operated"
  And the operator should indicate tier "free"
  And the response should include operator version
  And the response should NOT include any API key information

Scenario: Extension queries operator status in pro tier
  Given the operator is installed with a valid API key "kdy_prod_abc123"
  And the operator has successfully registered with kube9-server
  And the operator is running in "enabled" mode
  When the VS Code extension queries the operator status
  Then the operator should return status "enabled"
  And the operator should indicate tier "pro"
  And the response should include operator version
  And the response should include registration status with server
  And the response should NOT include the actual API key value

Scenario: Extension detects operator is not installed
  Given the operator is NOT installed in the cluster
  When the VS Code extension attempts to detect the operator
  Then the extension should determine the cluster is in "basic" mode
  And the extension should show appropriate installation prompts
  And the extension should fall back to kubectl-only operations

Scenario: Operator status is exposed via ConfigMap
  Given the operator is running
  When the operator updates its status
  Then the operator should write status to a ConfigMap in kube9-system namespace
  And the ConfigMap should be named "kube9-operator-status"
  And the ConfigMap should contain JSON-formatted status data
  And the ConfigMap should be readable by users with minimal cluster permissions

Scenario: Operator status includes health information
  Given the operator is running
  When status is queried
  Then the status should include operator health ("healthy", "degraded", "unhealthy")
  And the status should include last health check timestamp
  And the status should include any error messages if unhealthy

Scenario: Status is updated periodically
  Given the operator is running
  When the operator performs its status update cycle
  Then it should update the status ConfigMap every 60 seconds
  And the status should include the last update timestamp
  And stale status (> 5 minutes old) should be treated as unhealthy by extension

Scenario: Extension caches operator status
  Given the VS Code extension has queried operator status
  When the extension needs to check tier status again
  Then the extension should use cached status for 5 minutes
  And the extension should only re-query after cache expires
  And the extension should allow manual refresh to bypass cache

Scenario: Operator advertises its namespace in status
  Given the operator is running in any namespace
  When the operator updates its status ConfigMap
  Then the status data should include a "namespace" field
  And the namespace field should contain the actual namespace where the operator is deployed
  And the namespace field should use the POD_NAMESPACE environment variable
  And the namespace field should fallback to "kube9-system" if POD_NAMESPACE is not set

Scenario: Extension discovers operator namespace dynamically
  Given the operator is installed in a custom namespace "my-kube9-namespace"
  And the operator status ConfigMap is created in that namespace
  When the VS Code extension queries for the operator status
  Then the extension should first check the default "kube9-system" namespace
  And if found, the extension should read the "namespace" field from the status
  And the extension should use that namespace for all subsequent operator interactions
  And the extension should discover operator pods in the correct namespace
  And the extension should execute commands in the correct namespace

Scenario: Operator works in custom namespace
  Given a user installs the operator using Helm
  And the user specifies a custom namespace "custom-operator-ns"
  When the operator starts
  Then it should detect its namespace from the POD_NAMESPACE environment variable
  And it should create the status ConfigMap in "custom-operator-ns"
  And the status data should indicate namespace: "custom-operator-ns"
  And the VS Code extension should discover and connect to it successfully

Scenario: Namespace defaults to kube9-system
  Given the operator is installed using standard documentation
  And no custom namespace is specified
  When the operator is deployed
  Then it should run in the "kube9-system" namespace
  And the status ConfigMap should be created in "kube9-system"
  And the status data should indicate namespace: "kube9-system"
  And this should be the conventional default for ease of use
```

## Integration Points

- **VS Code Extension**: Primary consumer of status information
- **Status ConfigMap**: Kubernetes-native status storage
- **kube9-server**: Validates operator registration (pro tier only)

## Non-Goals

- Metrics collection (future feature)
- Detailed cluster health reporting (future feature)
- Historical status data (future feature)

