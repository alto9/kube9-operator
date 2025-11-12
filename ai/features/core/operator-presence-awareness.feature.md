---
feature_id: operator-presence-awareness
spec_id: [status-api-spec]
context_id: [kubernetes-operator-development]
---

# Operator Presence Awareness and Reporting Feature

## Overview

The VS Code extension must be aware of the presence and status of the kube9-operator in each connected cluster, and report this status visually to users through icons and context menus.

## Behavior

```gherkin
Feature: Operator Presence Awareness and Reporting

Background:
  Given the VS Code extension is connected to a Kubernetes cluster
  And the extension has access to the cluster via kubeconfig
  And the extension maintains a clusters view showing all connected clusters

Scenario: Extension detects operator presence on cluster connection
  Given a user connects to a Kubernetes cluster
  When the extension establishes the cluster connection
  Then the extension should check for the kube9-operator-status ConfigMap in kube9-system namespace
  And the extension should determine the cluster's operator status
  And the extension should cache the status for 5 minutes

Scenario: Extension determines basic status when operator not installed
  Given the operator is NOT installed in the cluster
  When the extension checks for operator presence
  Then the extension should determine cluster status is "basic"
  And the extension should enable kubectl-only operations
  And the extension should show installation prompts for the operator
  And the extension should display a basic status icon in the clusters view

Scenario: Extension determines operated status when operator installed without key
  Given the operator is installed in the cluster
  And the operator has no API key configured
  And the operator is running in "operated" mode
  When the extension checks for operator presence
  Then the extension should determine cluster status is "operated"
  And the extension should enable local webviews and basic features
  And the extension should show upgrade prompts for Pro tier features
  And the extension should display an operated status icon in the clusters view

Scenario: Extension determines enabled status when operator installed with valid key
  Given the operator is installed in the cluster
  And the operator has a valid API key configured
  And the operator has successfully registered with kube9-server
  And the operator is running in "enabled" mode
  When the extension checks for operator presence
  Then the extension should determine cluster status is "enabled"
  And the extension should enable rich UIs from server
  And the extension should enable AI features and advanced dashboards
  And the extension should display an enabled status icon in the clusters view

Scenario: Extension determines degraded status when operator has issues
  Given the operator is installed in the cluster
  And the operator has a valid API key configured
  And the operator status ConfigMap exists
  And the operator status indicates "degraded" health
  Or the operator status timestamp is stale (> 5 minutes old)
  When the extension checks for operator presence
  Then the extension should determine cluster status is "degraded"
  And the extension should enable temporary fallback features
  And the extension should show a warning about registration issues
  And the extension should display a degraded status icon in the clusters view

Scenario: Extension updates cluster icon based on operator status
  Given the extension has determined a cluster's operator status
  When the extension displays the cluster in the clusters view
  Then the extension should display an icon that reflects the status
  And the icon should be different for each status: basic, operated, enabled, degraded
  And the icon should be visually distinct to help users quickly identify status

Scenario: Extension shows status in cluster hover context menu
  Given a cluster is displayed in the clusters view
  When a user hovers over the cluster
  Then the extension should display a context menu
  And the context menu should include the operator status information
  And the status information should show the cluster status mode (basic/operated/enabled/degraded)
  And the status information should show the operator tier (free/pro) if available
  And the status information should show the operator version if available
  And the status information should show the operator health if available
  And the status information should show any error messages if status is degraded

Scenario: Extension refreshes operator status periodically
  Given the extension has cached operator status for a cluster
  When 5 minutes have passed since the last status check
  And the extension needs to display cluster information
  Then the extension should refresh the operator status from the cluster
  And the extension should update the cached status
  And the extension should update the cluster icon if status changed
  And the extension should update the hover context menu if status changed

Scenario: Extension handles status check failures gracefully
  Given the extension is attempting to check operator status
  When the status check fails due to network error
  Or the status check fails due to RBAC permissions
  Or the status check fails due to cluster connectivity issues
  Then the extension should not crash or show error dialogs
  And the extension should fall back to cached status if available
  And the extension should display a degraded status icon if no cache available
  And the extension should retry the status check on next refresh cycle

Scenario: Extension maintains status awareness across all clusters
  Given the extension is connected to multiple clusters
  When the extension displays the clusters view
  Then the extension should be aware of each cluster's operator status
  And the extension should display appropriate icons for each cluster
  And the extension should allow users to see status for each cluster independently
  And the extension should cache status separately for each cluster

Scenario: Extension uses status to enable appropriate features
  Given the extension has determined a cluster's operator status
  When the user interacts with that cluster
  Then the extension should enable features appropriate to the status
  And the extension should disable features not available for the status
  And the extension should show upgrade prompts for unavailable features when appropriate
```

## Integration Points

- **VS Code Extension**: Primary system implementing presence awareness
- **Status ConfigMap**: Source of truth for operator status
- **Clusters View**: UI component displaying status icons
- **Hover Context Menu**: UI component displaying detailed status information

## Status Definitions

| Status | Operator State | Features Available | Icon Indication |
|--------|---------------|-------------------|-----------------|
| **basic** | No operator installed | kubectl-only operations, show installation prompts | Basic/minimal icon |
| **operated** | Installed, no API key | Local webviews, basic features, show upgrade prompts | Operated/free tier icon |
| **enabled** | Installed, has valid API key, registered | Rich UIs from server, AI features, advanced dashboards | Enabled/pro tier icon |
| **degraded** | Installed, has API key, but registration failed or stale | Temporary fallback, registration failed | Degraded/warning icon |

## Non-Goals

- Operator installation from extension (future feature)
- Status history or trends (future feature)
- Real-time status push notifications (future feature)
- Status-based automatic actions (future feature)

