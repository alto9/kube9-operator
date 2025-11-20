---
feature_id: argocd-awareness
spec_id: [argocd-detection-spec]
diagram_id: [argocd-detection-flow]
context_id: [kubernetes-operator-development]
---

# ArgoCD Awareness Feature

## Overview

The operator must detect whether ArgoCD is installed in the cluster and expose this information through the OperatorStatus. This enables the VS Code extension to conditionally show ArgoCD-related features and provides the foundation for future ArgoCD integration and AI-powered GitOps insights.

## Behavior

```gherkin
Feature: ArgoCD Awareness

Background:
  Given the kube9 operator is running in a Kubernetes cluster
  And the operator has RBAC permissions to list CRDs and check for ArgoCD resources

Scenario: ArgoCD detected in default namespace
  Given ArgoCD is installed in the "argocd" namespace
  And the Application CRD (applications.argoproj.io) exists
  And the argocd-server deployment is running
  When the operator performs ArgoCD detection
  Then the operator should set argocd.detected to true
  And the operator should set argocd.namespace to "argocd"
  And the operator should extract ArgoCD version from the server deployment
  And the operator should update the OperatorStatus with ArgoCD information

Scenario: ArgoCD detected in custom namespace
  Given ArgoCD is installed in the "gitops" namespace
  And the Application CRD exists
  And the Helm values specify argocd.namespace as "gitops"
  When the operator performs ArgoCD detection
  Then the operator should check the configured "gitops" namespace
  And the operator should set argocd.detected to true
  And the operator should set argocd.namespace to "gitops"
  And the operator should verify the argocd-server deployment in "gitops" namespace

Scenario: ArgoCD not installed
  Given ArgoCD is NOT installed in the cluster
  And the Application CRD does not exist
  When the operator performs ArgoCD detection
  Then the operator should set argocd.detected to false
  And the operator should set argocd.namespace to null
  And the operator should set argocd.version to null
  And the operator should continue normal operation without errors

Scenario: ArgoCD detection disabled via configuration
  Given the Helm values specify argocd.autoDetect as false
  When the operator starts up
  Then the operator should skip ArgoCD detection
  And the operator should set argocd.detected to false
  And the operator should not perform periodic ArgoCD checks

Scenario: ArgoCD explicitly enabled via configuration
  Given the Helm values specify argocd.enabled as true
  And the Helm values specify argocd.namespace as "argocd"
  When the operator performs ArgoCD detection
  Then the operator should bypass CRD detection
  And the operator should directly check the specified namespace
  And the operator should set argocd.detected to true if deployment found
  And the operator should set argocd.detected to false if deployment not found

Scenario: Periodic ArgoCD detection
  Given the operator has completed startup ArgoCD detection
  And ArgoCD was initially not detected
  When 6 hours have elapsed since the last detection check
  Then the operator should perform ArgoCD detection again
  And the operator should update the OperatorStatus if detection result changed
  And the operator should log the detection result at INFO level

Scenario: ArgoCD installed after operator starts
  Given the operator started with ArgoCD not detected
  And argocd.detected is false in OperatorStatus
  When ArgoCD is installed in the cluster
  And the periodic detection check runs
  Then the operator should detect ArgoCD
  And the operator should update argocd.detected to true
  And the operator should log "ArgoCD installation detected" at INFO level

Scenario: ArgoCD uninstalled after detection
  Given the operator has detected ArgoCD
  And argocd.detected is true in OperatorStatus
  When ArgoCD is uninstalled from the cluster
  And the periodic detection check runs
  Then the operator should detect ArgoCD is no longer present
  And the operator should update argocd.detected to false
  And the operator should clear argocd.namespace and argocd.version
  And the operator should log "ArgoCD uninstallation detected" at INFO level

Scenario: Detection failure handling
  Given the operator is performing ArgoCD detection
  When the Kubernetes API returns an error checking for CRDs
  Then the operator should log the error at WARN level
  And the operator should set argocd.detected to false
  And the operator should continue normal operation
  And the operator should retry detection on the next periodic check

Scenario: VS Code extension reads ArgoCD status
  Given the operator has detected ArgoCD
  And the OperatorStatus contains argocd information
  When the VS Code extension queries the operator status
  Then the extension should receive argocd.detected as true
  And the extension should receive the ArgoCD namespace
  And the extension should conditionally show ArgoCD tree view section
  And the extension should enable ArgoCD-related commands

Scenario: VS Code extension when ArgoCD not detected
  Given the operator has not detected ArgoCD
  And argocd.detected is false in OperatorStatus
  When the VS Code extension queries the operator status
  Then the extension should hide ArgoCD tree view section
  And the extension should disable ArgoCD-related commands
  And the extension should not show any ArgoCD-related UI elements

Scenario: Detection with insufficient RBAC permissions
  Given the operator does not have permission to list CRDs
  When the operator attempts ArgoCD detection
  Then the operator should log "Insufficient permissions for ArgoCD detection" at WARN level
  And the operator should set argocd.detected to false
  And the operator should continue normal operation
  And the operator should not retry until RBAC permissions are fixed

Scenario: Multiple ArgoCD installations
  Given ArgoCD is installed in both "argocd" and "argocd-staging" namespaces
  When the operator performs detection
  Then the operator should detect the namespace specified in configuration
  Or the operator should detect the default "argocd" namespace
  And the operator should log a warning about multiple installations
  And the operator should only track one ArgoCD instance

Scenario: Version detection from deployment
  Given ArgoCD is installed with version "v2.8.0"
  And the argocd-server deployment has label "app.kubernetes.io/version=v2.8.0"
  When the operator detects ArgoCD
  Then the operator should extract version from the deployment label
  And the operator should set argocd.version to "v2.8.0"
  And the operator should expose version in OperatorStatus

Scenario: Version detection failure
  Given ArgoCD is installed
  And the argocd-server deployment does not have a version label
  When the operator detects ArgoCD
  Then the operator should set argocd.detected to true
  And the operator should set argocd.version to null
  And the operator should log "Could not determine ArgoCD version" at DEBUG level
```

## Integration Points

- **VS Code Extension**: Primary consumer of ArgoCD status for conditional UI
- **OperatorStatus CRD**: Extended to include ArgoCD awareness fields
- **Helm Configuration**: Users can customize ArgoCD detection behavior
- **Kubernetes API**: CRD and deployment checks for detection

## Non-Goals

- Collecting ArgoCD Application data (future feature)
- Analyzing ArgoCD sync status (future feature)
- Providing ArgoCD recommendations (future feature)
- Managing or modifying ArgoCD resources

## Future Enhancements

This awareness feature is the foundation for:
1. **Phase 2**: Collecting ArgoCD Application status and sync information
2. **Phase 3**: Sending sanitized ArgoCD data to kube9-server (Pro tier)
3. **Phase 4**: AI-powered drift analysis and GitOps recommendations

